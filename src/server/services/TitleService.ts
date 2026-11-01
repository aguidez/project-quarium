import { Players } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { COSMETICS, CosmeticId, getBestTitle } from "shared/types/cosmetics";
import { DataService } from "./DataService";

/** Titles are checked this often (earned from a quest or an Ocean milestone, or a new character). */
const CHECK_INTERVAL = 1;
const BILLBOARD_NAME = "PlayerTitle";
const TITLE_COLOR = Color3.fromHex("#FFD54A");
const TITLE_STROKE = Color3.fromHex("#071320");

/**
 * Titles (cosmetics.ts, kind Title): the best title a player owns (TITLE_ORDER) floats above their character's head, for
 * every player to see. Server-made BillboardGui, so it replicates; nothing is stored beyond PlayerData.cosmetics.
 */
class TitleServiceSingleton implements Lifecycle {
	/** The title shown on each player's current character ("" for none). */
	private shown = new Map<Player, string>();

	public onInit() {
		Players.PlayerRemoving.Connect((player) => this.shown.delete(player));
	}

	public onStart() {
		print("[Server] TitleService started.");
		while (true) {
			for (const player of Players.GetPlayers()) this.refresh(player);
			task.wait(CHECK_INTERVAL);
		}
	}

	private refresh(player: Player) {
		const head = player.Character?.FindFirstChild("Head");
		if (!head?.IsA("BasePart")) return;
		const data = DataService.getData(player);
		const title = data ? getBestTitle(data.cosmetics) : undefined;
		const existing = head.FindFirstChild(BILLBOARD_NAME);
		const key = title ?? "";
		// A new character has no billboard yet: rebuild it even if the title didn't change
		if (this.shown.get(player) === key && (existing !== undefined) === (title !== undefined)) return;
		this.shown.set(player, key);
		existing?.Destroy();
		if (title) this.build(head, title);
	}

	private build(head: BasePart, title: CosmeticId) {
		const billboard = new Instance("BillboardGui");
		billboard.Name = BILLBOARD_NAME;
		billboard.Size = UDim2.fromScale(4.2, 0.65); // studs: readable from the lobby without hiding the tank
		billboard.StudsOffset = new Vector3(0, 2.6, 0); // above the default name
		billboard.MaxDistance = 120;
		billboard.LightInfluence = 0;
		billboard.ResetOnSpawn = false;
		const label = new Instance("TextLabel");
		label.Size = UDim2.fromScale(1, 1);
		label.BackgroundTransparency = 1;
		label.Font = Enum.Font.LuckiestGuy;
		label.Text = COSMETICS[title].displayName.upper();
		label.TextScaled = true;
		label.TextColor3 = TITLE_COLOR;
		const stroke = new Instance("UIStroke");
		stroke.Color = TITLE_STROKE;
		stroke.Thickness = 2;
		stroke.Parent = label;
		label.Parent = billboard;
		billboard.Parent = head;
	}
}

export const TitleService = new TitleServiceSingleton();
