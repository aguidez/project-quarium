// CollectionService tags shared between server and client
export const TAGS = {
	/** An aquarium model. Attributes: "PlotIndex" (number), "OwnerUserId" (number, absent when free). */
	Aquarium: "Aquarium",
	/** The water volume of an aquarium. Clicking it drops food. */
	AquariumWater: "AquariumWater",
	/**
	 * A fish model, built locally by each client (FishRenderController): the server has none.
	 * Attributes (local): "FishId", "FishType", "Hunger" (HungerState), "GrowthStage" (index in the fish
	 * type's growth stages), "Variant" (FishVariant), "Paused" (owner AFK: no hunger, growth or coins), "Dead" (leaving the tank),
	 * "Animated" (FishAnimationController debugging aid), "Asleep" (a UFO night mutation: idles, "z Z z" bubble).
	 */
	Fish: "Fish",
	/**
	 * The clickable hitbox of a coin dropped by a fish. Clicking it collects the money.
	 * Attributes: "Special", "Frozen" (onboarding coin waiting in the water to be collected),
	 * "Bubble" (a weak fish's fart bubble, rising instead of sinking, see CoinService.spawnBubble),
	 * "Ghost" (a ghost fish's ghost coin, translucent, worth 3 sparkling coins).
	 */
	Coin: "Coin",
	/**
	 * Studio-made fish model in ServerStorage.Assets.Fish; the server copies a species into
	 * ReplicatedStorage.Assets.Fish while one swims on the server (server/fishAssets), clients clone it. Attribute "FishType".
	 * PrimaryPart "Body": invisible anchored root sized to the fish, head toward -Z.
	 */
	FishTemplate: "FishTemplate",
	/**
	 * Recoloured SurfaceAppearance of a fish variant (ServerStorage.Assets.FishVariants, copied on demand into
	 * ReplicatedStorage.Assets.FishVariants like the fish templates; attributes
	 * "FishType" and "Variant"): the client puts a clone of it on the fish mesh in place of the
	 * template's (a texture can't be changed by a game script). Hue rotations of the species' ColorMap
	 * made by tools/fish-variant-recolor.js.
	 */
	FishVariantAppearance: "FishVariantAppearance",
	/**
	 * Studio-made coin model in ServerStorage.Assets. Attribute "CoinType".
	 * PrimaryPart "Hitbox": invisible anchored clickable root, coin face along Z.
	 */
	CoinTemplate: "CoinTemplate",
	/**
	 * Guest fish of a running event (e.g. the K-pop idol), swimming in every owned aquarium.
	 * Not a Fish: no owner, hunger nor coins. Attribute "EventType".
	 */
	EventFish: "EventFish",
	/** Studio-made event fish model in ServerStorage.Assets, laid out like a FishTemplate. Attribute "EventType". */
	EventFishTemplate: "EventFishTemplate",
	/**
	 * A UFO of the UFO night (UfoService), flying over its tank: a clone of the "Ufo" EventFishTemplate (not an
	 * EventFish: never animated as a fish). Attribute "Beaming" (shared/types/ufo UFO_BEAM_ATTRIBUTE).
	 */
	Ufo: "Ufo",
	/** An equipped companion in its owner's aquarium. Attributes: "Owner" (UserId), "CompanionType". */
	Companion: "Companion",
	/** Studio-made companion model in ServerStorage.Assets, laid out like a FishTemplate. Attribute "CompanionType". */
	CompanionTemplate: "CompanionTemplate",
	/**
	 * The fisherman selling the gamepasses in his hut on the beach (Workspace.Lobby.FishingHut, built in Studio): a
	 * Model with a PrimaryPart. Walking up to him opens the Shop panel (ShopKeeperController, client only).
	 */
	ShopKeeper: "ShopKeeper",
	/** Studio-made decor model in ServerStorage.Assets.Decor (a cosmetic shown in its owner's tank). Attribute "Cosmetic". */
	DecorTemplate: "DecorTemplate",
	/**
	 * Studio-made food look in ServerStorage.Assets.Food: a single anchored MeshPart (its size is the
	 * food's size). Attribute "FoodLook". The default pellet (FoodLook "Pellet") has none: it is a ball.
	 */
	FoodTemplate: "FoodTemplate",
	/**
	 * The like board beside an aquarium (cloned by LikeService into the aquarium model). Its "Board"
	 * part carries the counter on its Front face. Attribute "PlotIndex". The likes shown are the
	 * aquarium's attributes "Likes" and "LikeBoostEndsAt" (server time), absent while it is free.
	 */
	LikeBoard: "LikeBoard",
	/** Studio-made like board model in ServerStorage.Assets.LikeBoards (PrimaryPart "Root" at ground level, front -Z). */
	LikeBoardTemplate: "LikeBoardTemplate",
	/**
	 * Studio-made aquarium theme in ServerStorage.Assets.AquariumThemes (rebirths). Attribute "Theme".
	 * PrimaryPart "Origin" = the tank's frame (getAquariumFrame); a "Style" folder of parts named like
	 * the tank's parts (look copied onto them); the rest is decor. Tanks carry the attribute "Theme".
	 */
	AquariumThemeTemplate: "AquariumThemeTemplate",
} as const;
