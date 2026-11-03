import { Players, TextChatService } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import {
	COSMETICS,
	EARNED_TITLE_COLOR,
	isCosmeticId,
	TITLE_ATTRIBUTE,
	TITLE_RANK_ATTRIBUTE,
} from "shared/types/cosmetics";
import { getTitleTier, TITLE_TIER_STYLES } from "shared/types/leaderboards";

/**
 * The title a player wears, as a coloured tag before their name in the chat window ("[OCEAN LEGEND #1] Pinpin:"),
 * on every channel of the server. Read from the Player attributes TitleService sets; earned titles in gold, leaderboard
 * titles in their rank's tier colour.
 */
class ChatTitleControllerSingleton implements Lifecycle {
	public onInit() {}

	public onStart() {
		print("[Client] ChatTitleController started.");
		TextChatService.OnIncomingMessage = (message) => {
			const tag = this.getTag(message.TextSource);
			if (tag === undefined) return undefined;
			const properties = new Instance("TextChatMessageProperties");
			properties.PrefixText = `${tag} ${message.PrefixText}`;
			return properties;
		};
	}

	private getTag(source: TextSource | undefined): string | undefined {
		if (!source) return undefined; // system messages
		const player = Players.GetPlayerByUserId(source.UserId);
		const title = player?.GetAttribute(TITLE_ATTRIBUTE);
		if (!isCosmeticId(title)) return undefined;
		const rank = player?.GetAttribute(TITLE_RANK_ATTRIBUTE);
		const ranked = typeIs(rank, "number");
		const color = ranked ? TITLE_TIER_STYLES[getTitleTier(rank)].chat : EARNED_TITLE_COLOR;
		const label = COSMETICS[title].displayName.upper() + (ranked ? ` #${rank}` : "");
		return `<font color="#${color.ToHex()}">[${label}]</font>`;
	}
}

export const ChatTitleController = new ChatTitleControllerSingleton();
