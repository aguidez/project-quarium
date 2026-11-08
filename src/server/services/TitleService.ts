import { Players, TextService } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import {
	COSMETICS,
	CosmeticId,
	CREATOR_RAY_CENTER_COLOR,
	CREATOR_RAY_TIP_COLOR,
	CREATOR_TITLE,
	CREATOR_TITLE_COLOR,
	EARNED_TITLE_COLOR,
	isCreatorTitle,
	TITLE_ATTRIBUTE,
	TITLE_RANK_ATTRIBUTE,
} from "shared/types/cosmetics";
import { TAGS } from "shared/tags";
import { isCreator } from "../admins";
import { getDisplayedTitle, getTitleRank } from "shared/types/customization";
import {
	getTitleTier,
	LeaderboardId,
	TITLE_PLATE_IMAGES,
	TITLE_TIER_STYLES,
	TitleTierStyle,
} from "shared/types/leaderboards";
import { DataService } from "./DataService";

/** Titles are checked this often (earned from a quest or an Ocean milestone, or a new character). */
const CHECK_INTERVAL = 1;
const BILLBOARD_NAME = "PlayerTitle";
const OUTLINE = Color3.fromHex("#071320");
const WHITE = new Color3(1, 1, 1);
// The creator's title (studs): its text as tall as the earned ones' a bit bigger, in a taller billboard for the sun rays
const CREATOR_TEXT_WIDTH = 4.8;
const CREATOR_TEXT_HEIGHT = 0.75;
const CREATOR_BILLBOARD_WIDTH = 6;
const CREATOR_BILLBOARD_HEIGHT = 3.6; // the rays' span
/** Rays spread along the text, from one end to the other (bars through its line: a tip above and one below). */
const CREATOR_RAYS_ALONG = 11;
/** How far (degrees) the rays at the ends of the text lean outward; the ones between lean less. */
const CREATOR_RAY_FAN = 35;
/** The extra rays at each end of the text, opening sideways (degrees from upright, above and below). */
const CREATOR_END_RAY_ANGLES = [55, 75];

// Leaderboard nameplate, laid out in design pixels (FigCraft leaderboards.figcraft, Plate_*) and drawn in scale, so the
// billboard keeps its size in studs: a pill of PLATE_HEIGHT px, a rank badge overhanging its left end, the board's icon
// on its right end
const PLATE_HEIGHT = 56;
const PLATE_DEPTH = 6;
const PLATE_TEXT_SIZE = 28;
const PLATE_TEXT_X = 70; // where the title starts, after the badge
const PLATE_ICON_ROOM = 58;
const BADGE_SIZE = 66;
/** Room around the plate for what overhangs it (badge on the left, sparkle on the top). */
const MARGIN = { left: 10, top: 14, right: 4, bottom: 2 };
/** Studs per design pixel: a 56 px plate is 0.65 stud tall, the height of the earned titles. */
const STUDS_PER_PX = 0.65 / PLATE_HEIGHT;

/**
 * Titles (cosmetics.ts, kind Title): the title a player wears (getDisplayedTitle: their pick, else the best one they
 * hold) floats above their character's head, for every player to see. Earned titles are gold text; a leaderboard title
 * (held by the day's top 10 of its board) is a nameplate in its rank's tier: gold #1, silver #2, copper bronze #3, navy
 * for #4 to #10. Server-made BillboardGui, so it replicates; nothing is stored beyond PlayerData.
 */
class TitleServiceSingleton implements Lifecycle {
	/** The title shown on each player's current character ("" for none, "title#rank" for a leaderboard title). */
	private shown = new Map<Player, string>();

	public onInit() {
		Players.PlayerRemoving.Connect((player) => this.shown.delete(player));
		// The creator's title: given to the creator at each join, taken from anyone else (never earned)
		DataService.onLoaded((player, save) => {
			const cosmetics = save.player.cosmetics;
			const index = cosmetics.indexOf(CREATOR_TITLE);
			if (isCreator(player) && index < 0) {
				cosmetics.push(CREATOR_TITLE);
				save.player.titleChoice = CREATOR_TITLE; // worn the first time it is given (another one can be picked after)
			} else if (!isCreator(player) && index >= 0) cosmetics.remove(index);
		});
	}

	public onStart() {
		print("[Server] TitleService started.");
		while (true) {
			for (const player of Players.GetPlayers()) this.refresh(player);
			task.wait(CHECK_INTERVAL);
		}
	}

	private refresh(player: Player) {
		const data = DataService.getData(player);
		const title = data ? getDisplayedTitle(data) : undefined; // the player's pick, else the best one
		const rank = data && title ? getTitleRank(data, title) : undefined;
		// Also on the Player (ChatTitleController tags their chat messages with it), even without a character
		player.SetAttribute(TITLE_ATTRIBUTE, title);
		player.SetAttribute(TITLE_RANK_ATTRIBUTE, rank);
		const head = player.Character?.FindFirstChild("Head");
		if (!head?.IsA("BasePart")) return;
		const existing = head.FindFirstChild(BILLBOARD_NAME);
		const key = title === undefined ? "" : rank === undefined ? title : `${title}#${rank}`;
		// A new character has no billboard yet: rebuild it even if the title didn't change
		if (this.shown.get(player) === key && (existing !== undefined) === (title !== undefined)) return;
		this.shown.set(player, key);
		existing?.Destroy();
		if (!title) return;
		const board = COSMETICS[title].leaderboard;
		if (board !== undefined && rank !== undefined) this.buildPlate(head, title, board, rank);
		else this.buildText(head, title);
	}

	private buildText(head: BasePart, title: CosmeticId) {
		if (isCreatorTitle(title)) return this.buildCreator(head, title);
		const billboard = this.billboard(UDim2.fromScale(4.2, 0.65)); // studs: readable from the lobby without hiding the tank
		const label = new Instance("TextLabel");
		label.Size = UDim2.fromScale(1, 1);
		label.BackgroundTransparency = 1;
		label.Font = Enum.Font.LuckiestGuy;
		label.Text = COSMETICS[title].displayName.upper();
		label.TextScaled = true;
		label.TextColor3 = EARNED_TITLE_COLOR;
		this.stroke(label, OUTLINE, 2);
		label.Parent = billboard;
		billboard.Parent = head;
	}

	/**
	 * The creator's title: bright red letters with a dark outline, lit from their whole length: a soft golden band
	 * behind the text and sun rays spread along it, fanning outward (wider at both ends), each a bar through the text's
	 * line fading toward its tips (tagged TitleRay, attributes Angle and Phase: each client sways and shimmers them,
	 * TitleRaysController). The billboard is taller for the rays; the text sits in its middle, where the others' does.
	 */
	private buildCreator(head: BasePart, title: CosmeticId) {
		const billboard = this.billboard(UDim2.fromScale(CREATOR_BILLBOARD_WIDTH, CREATOR_BILLBOARD_HEIGHT));
		const textSpan = CREATOR_TEXT_WIDTH / CREATOR_BILLBOARD_WIDTH;
		// A ray is a bar centred on the text's line (a GuiObject turns around its centre) showing only one half: the one
		// above the line (up) or below it, so the rays above and below can both lean outward
		const rayGradient = (parent: Instance, up: boolean) => {
			const gradient = new Instance("UIGradient");
			gradient.Rotation = 90; // along the bar, from its top (0) to its bottom (1)
			gradient.Color = new ColorSequence([
				new ColorSequenceKeypoint(0, CREATOR_RAY_TIP_COLOR),
				new ColorSequenceKeypoint(0.5, CREATOR_RAY_CENTER_COLOR),
				new ColorSequenceKeypoint(1, CREATOR_RAY_TIP_COLOR),
			]);
			gradient.Transparency = up
				? new NumberSequence([
						new NumberSequenceKeypoint(0, 1),
						new NumberSequenceKeypoint(0.25, 0.6),
						new NumberSequenceKeypoint(0.49, 0.2),
						new NumberSequenceKeypoint(0.5, 1),
						new NumberSequenceKeypoint(1, 1),
					])
				: new NumberSequence([
						new NumberSequenceKeypoint(0, 1),
						new NumberSequenceKeypoint(0.5, 1),
						new NumberSequenceKeypoint(0.51, 0.2),
						new NumberSequenceKeypoint(0.75, 0.6),
						new NumberSequenceKeypoint(1, 1),
					]);
			gradient.Parent = parent;
		};
		/** A ray from the text's line at `x`, leaning `lean` degrees outward (signed: + to the right), up or down. */
		const addHalfRay = (x: number, lean: number, up: boolean, length: number, width: number, phase: number) => {
			// Up: the top half shows, so the bar leans its top that way; down: the bottom half, the other way
			const angle = up ? lean : -lean;
			const ray = new Instance("Frame");
			ray.Name = `Ray${phase}`;
			ray.AnchorPoint = new Vector2(0.5, 0.5);
			ray.Position = UDim2.fromScale(x, 0.5);
			ray.Size = UDim2.fromScale(width, length);
			ray.BackgroundColor3 = WHITE;
			ray.BorderSizePixel = 0;
			ray.Rotation = angle;
			ray.ZIndex = 1;
			ray.SetAttribute("Angle", angle);
			ray.SetAttribute("Phase", phase);
			const corner = new Instance("UICorner");
			corner.CornerRadius = new UDim(0.5, 0);
			corner.Parent = ray;
			rayGradient(ray, up);
			ray.AddTag(TAGS.TitleRay);
			ray.Parent = billboard;
		};
		// Along the text, above and below it: rays from one end to the other, leaning outward toward the ends, long and
		// short in turn (above and below alternate the other way)
		let phase = 0;
		for (let i = 0; i < CREATOR_RAYS_ALONG; i++) {
			const side = (i / (CREATOR_RAYS_ALONG - 1)) * 2 - 1; // -1 left end, 1 right end
			const x = 0.5 + (side * textSpan) / 2;
			for (const up of [true, false]) {
				const long = (i % 2 === 0) === up;
				addHalfRay(x, side * CREATOR_RAY_FAN, up, long ? 0.95 : 0.7, long ? 0.035 : 0.025, phase++);
			}
		}
		// At each end: rays opening sideways, so the light wraps the whole word
		CREATOR_END_RAY_ANGLES.forEach((angle, index) => {
			for (const side of [-1, 1]) {
				const x = 0.5 + (side * textSpan) / 2;
				for (const up of [true, false])
					addHalfRay(x, side * angle, up, index % 2 === 0 ? 0.6 : 0.45, 0.025, phase++);
			}
		});
		// The text's own glow: a soft golden band behind it, as long as the word
		const band = new Instance("Frame");
		band.Name = "Glow";
		band.AnchorPoint = new Vector2(0.5, 0.5);
		band.Position = UDim2.fromScale(0.5, 0.5);
		band.Size = UDim2.fromScale(textSpan * 1.05, (CREATOR_TEXT_HEIGHT * 1.4) / CREATOR_BILLBOARD_HEIGHT);
		band.BackgroundColor3 = CREATOR_RAY_CENTER_COLOR;
		band.BorderSizePixel = 0;
		band.ZIndex = 2;
		const bandCorner = new Instance("UICorner");
		bandCorner.CornerRadius = new UDim(0.5, 0);
		bandCorner.Parent = band;
		const bandGradient = new Instance("UIGradient");
		bandGradient.Rotation = 90;
		bandGradient.Transparency = new NumberSequence([
			new NumberSequenceKeypoint(0, 1),
			new NumberSequenceKeypoint(0.5, 0.45),
			new NumberSequenceKeypoint(1, 1),
		]);
		bandGradient.Parent = band;
		band.Parent = billboard;

		const label = new Instance("TextLabel");
		label.Name = "Title";
		label.AnchorPoint = new Vector2(0.5, 0.5);
		label.Position = UDim2.fromScale(0.5, 0.5);
		label.Size = UDim2.fromScale(textSpan, CREATOR_TEXT_HEIGHT / CREATOR_BILLBOARD_HEIGHT);
		label.BackgroundTransparency = 1;
		label.Font = Enum.Font.LuckiestGuy;
		label.Text = COSMETICS[title].displayName.upper();
		label.TextScaled = true;
		label.TextColor3 = CREATOR_TITLE_COLOR;
		label.ZIndex = 3;
		this.stroke(label, Color3.fromHex("#3A0505"), 2);
		label.Parent = billboard;
		billboard.Parent = head;
	}

	private billboard(size: UDim2): BillboardGui {
		const billboard = new Instance("BillboardGui");
		billboard.Name = BILLBOARD_NAME;
		billboard.Size = size;
		billboard.StudsOffset = new Vector3(0, 2.6, 0); // above the default name
		billboard.MaxDistance = 120;
		billboard.LightInfluence = 0;
		billboard.ResetOnSpawn = false;
		return billboard;
	}

	private stroke(parent: GuiObject, color: Color3, thickness: number, border = false) {
		const stroke = new Instance("UIStroke");
		stroke.Color = color;
		stroke.Thickness = thickness;
		stroke.LineJoinMode = Enum.LineJoinMode.Round;
		if (border) stroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border;
		stroke.Parent = parent;
	}

	private buildPlate(head: BasePart, title: CosmeticId, board: LeaderboardId, rank: number) {
		const style = TITLE_TIER_STYLES[getTitleTier(rank)];
		const text = COSMETICS[title].displayName.upper();
		const textWidth = TextService.GetTextSize(
			text,
			PLATE_TEXT_SIZE,
			Enum.Font.LuckiestGuy,
			new Vector2(1000, 100),
		).X;
		const plateWidth = PLATE_TEXT_X + textWidth + 8 + PLATE_ICON_ROOM;
		const width = MARGIN.left + plateWidth + MARGIN.right;
		const height = MARGIN.top + PLATE_HEIGHT + PLATE_DEPTH + MARGIN.bottom;
		// Design pixels (from the plate's top-left corner) to the billboard's scale
		const at = (x: number, y: number) => UDim2.fromScale((MARGIN.left + x) / width, (MARGIN.top + y) / height);
		const size = (w: number, h: number) => UDim2.fromScale(w / width, h / height);

		const billboard = this.billboard(UDim2.fromScale(width * STUDS_PER_PX, height * STUDS_PER_PX));
		billboard.StudsOffset = new Vector3(0, 2.7, 0);
		const frame = (name: string, parent: Instance, x: number, y: number, w: number, h: number, zIndex: number) => {
			const f = new Instance("Frame");
			f.Name = name;
			f.Position = at(x, y);
			f.Size = size(w, h);
			f.BackgroundColor3 = WHITE;
			f.BorderSizePixel = 0;
			f.ZIndex = zIndex;
			f.Parent = parent;
			const corner = new Instance("UICorner");
			corner.CornerRadius = new UDim(0.5, 0);
			corner.Parent = f;
			return f;
		};
		const gradient = (parent: Instance, top: Color3, bottom: Color3) => {
			const g = new Instance("UIGradient");
			g.Color = new ColorSequence(top, bottom);
			g.Rotation = 90;
			g.Parent = parent;
		};
		const label = (
			parent: Instance,
			x: number,
			y: number,
			w: number,
			h: number,
			value: string,
			outline: Color3,
			zIndex: number,
		) => {
			const l = new Instance("TextLabel");
			l.Position = at(x, y);
			l.Size = size(w, h);
			l.BackgroundTransparency = 1;
			l.Font = Enum.Font.LuckiestGuy;
			l.Text = value;
			l.TextScaled = true;
			l.TextColor3 = WHITE;
			l.ZIndex = zIndex;
			this.stroke(l, outline, 2);
			l.Parent = parent;
		};

		const shadow = frame("Shadow", billboard, 0, PLATE_DEPTH, plateWidth, PLATE_HEIGHT, 1);
		shadow.BackgroundColor3 = style.shadow;
		this.stroke(shadow, OUTLINE, 2, true);
		const face = frame("Face", billboard, 0, 0, plateWidth, PLATE_HEIGHT, 2);
		gradient(face, style.faceTop, style.faceBottom);
		this.stroke(face, OUTLINE, 2, true);
		const gloss = frame("Gloss", billboard, 30, 4, plateWidth - 60, 20, 3);
		gloss.BackgroundTransparency = style.gloss;
		label(billboard, PLATE_TEXT_X, 9, textWidth + 4, PLATE_HEIGHT - 16, text, style.shadow, 5);
		this.buildIcon(billboard, board, at(plateWidth - 50, 9), size(38, 38));

		const badge = frame("RankBadge", billboard, -8, -5, BADGE_SIZE, BADGE_SIZE, 6);
		gradient(badge, style.badgeTop, style.badgeBottom);
		this.stroke(badge, OUTLINE, 2, true);
		label(billboard, -8 + 12, -5 + 14, BADGE_SIZE - 24, BADGE_SIZE - 26, tostring(rank), style.badgeShadow, 7); // over the badge
		for (const [i, sparkle] of ipairs(this.sparkles(style, plateWidth))) {
			const image = new Instance("ImageLabel");
			image.Name = `Sparkle${i}`;
			image.Position = at(sparkle.x, sparkle.y);
			image.Size = size(sparkle.size, sparkle.size);
			image.BackgroundTransparency = 1;
			image.Image = TITLE_PLATE_IMAGES.sparkle;
			image.ZIndex = 7;
			image.Parent = billboard;
		}
		billboard.Parent = head;
	}

	private sparkles(style: TitleTierStyle, plateWidth: number) {
		const all = [
			{ x: plateWidth - 30, y: -12, size: 26 },
			{ x: 52, y: PLATE_HEIGHT - 8, size: 18 },
		];
		const result = new Array<{ x: number; y: number; size: number }>();
		for (let i = 0; i < math.min(style.sparkles, all.size()); i++) result.push(all[i]);
		return result;
	}

	/** The board's icon at the plate's right end: the Ocean side icon, a gold coin or a white clock, drawn like the signs'. */
	private buildIcon(parent: Instance, board: LeaderboardId, position: UDim2, size: UDim2) {
		if (board === "OceanPoints") {
			const image = new Instance("ImageLabel");
			image.Name = "Icon";
			image.Position = position;
			image.Size = size;
			image.BackgroundTransparency = 1;
			image.Image = TITLE_PLATE_IMAGES.ocean;
			image.ScaleType = Enum.ScaleType.Fit;
			image.ZIndex = 5;
			image.Parent = parent;
			return;
		}
		const disc = new Instance("Frame");
		disc.Name = "Icon";
		disc.Position = position;
		disc.Size = size;
		disc.BackgroundColor3 = WHITE;
		disc.BorderSizePixel = 0;
		disc.ZIndex = 5;
		const corner = new Instance("UICorner");
		corner.CornerRadius = new UDim(0.5, 0);
		corner.Parent = disc;
		const gradient = new Instance("UIGradient");
		gradient.Rotation = 90;
		gradient.Color =
			board === "Income"
				? new ColorSequence(Color3.fromHex("#FFE680"), Color3.fromHex("#E89A00"))
				: new ColorSequence(WHITE, Color3.fromHex("#D8F7E2"));
		gradient.Parent = disc;
		this.stroke(disc, OUTLINE, 2, true);
		const mark = (name: string, pos: UDim2, markSize: UDim2, color: Color3) => {
			const f = new Instance("Frame");
			f.Name = name;
			f.Position = pos;
			f.Size = markSize;
			f.BackgroundColor3 = color;
			f.BorderSizePixel = 0;
			f.ZIndex = 6;
			const c = new Instance("UICorner");
			c.CornerRadius = new UDim(0.5, 0);
			c.Parent = f;
			f.Parent = disc;
		};
		if (board === "Income") {
			mark("Inner", UDim2.fromScale(0.17, 0.17), UDim2.fromScale(0.66, 0.66), Color3.fromHex("#FFC21A"));
			const symbol = new Instance("TextLabel");
			symbol.Size = UDim2.fromScale(1, 1);
			symbol.Position = UDim2.fromScale(0, 0.06);
			symbol.BackgroundTransparency = 1;
			symbol.Font = Enum.Font.LuckiestGuy;
			symbol.Text = "$";
			symbol.TextScaled = true;
			symbol.TextColor3 = Color3.fromHex("#B86E00");
			symbol.ZIndex = 7;
			const padding = new Instance("UIPadding");
			padding.PaddingTop = new UDim(0.22, 0);
			padding.PaddingBottom = new UDim(0.22, 0);
			padding.Parent = symbol;
			symbol.Parent = disc;
		} else {
			mark("HandUp", UDim2.fromScale(0.45, 0.2), UDim2.fromScale(0.1, 0.32), OUTLINE);
			mark("HandRight", UDim2.fromScale(0.45, 0.45), UDim2.fromScale(0.28, 0.1), Color3.fromHex("#1C9C52"));
		}
		disc.Parent = parent;
	}
}

export const TitleService = new TitleServiceSingleton();
