// Shared UI tokens, taken from the FigCraft design (design/ui/shopbar.figcraft).

import { EggType } from "shared/types/eggs";
import type { AquariumTheme } from "shared/types/rebirths";
import { FishRarity, FishType, FISH_TYPES } from "shared/types/fish";
import { FishVariant } from "shared/types/variants";

// UI V2 "arcade aquatic" (FigCraft: design/ui/redesign-v2.figcraft, UIKit_V2): Fredoka One for every text,
// Luckiest Guy for titles, buttons and big numbers, always with a dark outline (kit.tsx TextStroke).
export const FONT_BOLD = Enum.Font.FredokaOne;
export const FONT_BLACK = Enum.Font.FredokaOne;
export const FONT_TITLE = Enum.Font.LuckiestGuy;

/** Every outline of the V2 UI: buttons, cards, slots, text strokes. */
export const OUTLINE = Color3.fromHex("#071320");

/**
 * Colours of a pseudo-3D element (kit.tsx Button3D): `light` (top of the face's gradient), `base` (its
 * bottom), `dark` (bottom when pressed) and `shadow` (the bevel under the face, and the text outline).
 */
export interface Palette {
	light: Color3;
	base: Color3;
	dark: Color3;
	shadow: Color3;
}

function palette(light: string, base: string, dark: string, shadow: string): Palette {
	return {
		light: Color3.fromHex(light),
		base: Color3.fromHex(base),
		dark: Color3.fromHex(dark),
		shadow: Color3.fromHex(shadow),
	};
}

/** FigCraft UIKit_V2 "BUTTONS": green = main action, blue = secondary, gold = buy, red = confirm / close. */
export const PALETTES = {
	green: palette("#8CF5A8", "#2ECC71", "#1C9C52", "#0E6332"),
	blue: palette("#7CC8FF", "#0A84FF", "#0866CC", "#053D80"),
	lagoon: palette("#8AF7F9", "#00C2CB", "#00939C", "#005A61"),
	gold: palette("#FFF3A0", "#FFD233", "#F0A500", "#8F5A00"),
	red: palette("#FF9AA6", "#FF4D5E", "#D92B45", "#7E0E22"),
	purple: palette("#D9ABFF", "#A55CFF", "#7C34D9", "#44167F"),
	pink: palette("#FFA8C4", "#FF5C8A", "#D93A6A", "#7A1236"),
	navy: palette("#2F5684", "#1E3A5C", "#162C46", "#08121D"),
	grey: palette("#C9D3DC", "#8C99A6", "#6A7682", "#3A434C"),
	ghost: palette("#E6FAFF", "#9FE3FF", "#6CC4EA", "#2A6A85"),
	amber: palette("#FFE8A8", "#F5A623", "#D9860C", "#7A4A06"),
};

/** Navy surfaces of the V2 UI: windows, cards, tracks. */
export const NAVY = {
	windowTop: Color3.fromHex("#23446E"),
	windowBottom: Color3.fromHex("#0F1B29"),
	windowShadow: Color3.fromHex("#050B12"),
	cardTop: Color3.fromHex("#2B5182"),
	cardBottom: Color3.fromHex("#1A3456"),
	cardShadow: Color3.fromHex("#08121D"),
	track: Color3.fromHex("#0A1624"),
	muted: Color3.fromHex("#A9CBEF"),
	inactiveText: Color3.fromHex("#9FC3E8"),
	missingTop: Color3.fromHex("#24456B"),
	missingBottom: Color3.fromHex("#132A44"),
};

/**
 * V2 sprites (design/ui/v2, exported from redesign-v2.figcraft "Assets_V2"). The white ones are tinted in
 * game (ImageColor3 / UIGradient multiply them; their dark outline stays dark).
 */
export const V2_IMAGES = {
	iconQuests: "rbxassetid://131369239053579",
	iconFishIndex: "rbxassetid://117500058635391",
	iconOcean: "rbxassetid://86767682222210",
	iconRebirth: "rbxassetid://123446163856086",
	iconAquarium: "rbxassetid://102450232903984", // design/ui/passes/Pass_Aquarium.png (tools/pass-icons.js)
	ribbonTailLeft: "rbxassetid://132217540092284", // white tail + grey fold, 64x56 design px
	ribbonTailRight: "rbxassetid://119721448521037",
	sparkle: "rbxassetid://84841007993115", // white 4-point star
	softGlow: "rbxassetid://94658909138748", // white radial glow
};

export const COLORS = {
	gold: Color3.fromHex("#E8B44A"),
	goldDark: Color3.fromHex("#6E4A12"),
	railTop: Color3.fromHex("#F4CF7A"),
	railBottom: Color3.fromHex("#A8741F"),
	white: Color3.fromHex("#FFFFFF"),
};

/** Egg shop slot states (FigCraft redesign-v2: EggSlot_*); EggSlot.tsx maps each to a palette. */
export type SlotState = "buyable" | "unaffordable" | "hatching" | "ready" | "locked";

/** Vertical (top -> bottom) gradient, the Roblox equivalent of FigCraft's linear gradient. */
export function verticalGradient(top: Color3, bottom: Color3): ColorSequence {
	return new ColorSequence(top, bottom);
}

/** The French Fish (easter egg) has no variant: one sticker, front three-quarter view (its scarf must read as a scarf). */
const FRENCH_FISH_ICON = "rbxassetid://83659319201974"; // Icon_FrenchFish_Normal.png
/** The alien fish (UFO night easter egg) has no variant either: one sticker, front three-quarter view (its smiling side). */
const ALIEN_FISH_ICON = "rbxassetid://140655796951738"; // Icon_AlienFish_Normal.png

/** Fish icons exported from FigCraft at 2x and uploaded to Roblox. */
/**
 * Sticker icon of every fish in every variant (Fish Index, Ocean, hatch reveal): renders of the real
 * models with a thick outline (white, pale blue for a ghost, gold for a shiny) and a soft shadow,
 * 256×160 (design/ui/fish/stickers, made by tools/fish-sticker-icons.js). A missing entry of the Fish
 * Index shows the normal icon as a dark silhouette.
 */
export const FISH_ICONS: Record<FishType, Record<FishVariant, string>> = {
	Basic: {
		Normal: "rbxassetid://110816578059946",
		Anomaly: "rbxassetid://81342229332826",
		Ghost: "rbxassetid://122884795120966",
		Shiny: "rbxassetid://120579157264598",
	},
	Big: {
		Normal: "rbxassetid://79814556352685",
		Anomaly: "rbxassetid://99760732461454",
		Ghost: "rbxassetid://110304916312275",
		Shiny: "rbxassetid://120996176272657",
	},
	RedTetra: {
		Normal: "rbxassetid://86618308058080",
		Anomaly: "rbxassetid://103307326043288",
		Ghost: "rbxassetid://106797427209781",
		Shiny: "rbxassetid://71943826792937",
	},
	Clownfish: {
		Normal: "rbxassetid://114102644558524",
		Anomaly: "rbxassetid://70664728701506",
		Ghost: "rbxassetid://70705428026205",
		Shiny: "rbxassetid://133655556487680",
	},
	ZebraDanio: {
		Normal: "rbxassetid://138477666040081",
		Anomaly: "rbxassetid://131837360407704",
		Ghost: "rbxassetid://101750992429024",
		Shiny: "rbxassetid://104468280292133",
	},
	FlameGourami: {
		Normal: "rbxassetid://123542852004775",
		Anomaly: "rbxassetid://96832484650921",
		Ghost: "rbxassetid://98937947123813",
		Shiny: "rbxassetid://99142483619384",
	},
	SilverAngelfish: {
		Normal: "rbxassetid://132775879168139",
		Anomaly: "rbxassetid://110848707606414",
		Ghost: "rbxassetid://72774080667754",
		Shiny: "rbxassetid://109331093351123",
	},
	PirateFish: {
		Normal: "rbxassetid://140042928133697",
		Anomaly: "rbxassetid://110288096561899",
		Ghost: "rbxassetid://134728004078355",
		Shiny: "rbxassetid://107412512620557",
	},
	ImperialDiscus: {
		Normal: "rbxassetid://139654199951383",
		Anomaly: "rbxassetid://112097089028511",
		Ghost: "rbxassetid://74436895352088",
		Shiny: "rbxassetid://122796208562105",
	},
	Catfish: {
		Normal: "rbxassetid://79912028142678",
		Anomaly: "rbxassetid://101981295520070",
		Ghost: "rbxassetid://108703439719644",
		Shiny: "rbxassetid://88991604714601",
	},
	BlueTang: {
		Normal: "rbxassetid://84168600741956",
		Anomaly: "rbxassetid://97068349463650",
		Ghost: "rbxassetid://90036740164027",
		Shiny: "rbxassetid://78945259622335",
	},
	BabySunfish: {
		Normal: "rbxassetid://137342877522798",
		Anomaly: "rbxassetid://108132028623203",
		Ghost: "rbxassetid://104893016520068",
		Shiny: "rbxassetid://114271773447954",
	},
	Lanternfish: {
		Normal: "rbxassetid://128662677168064",
		Anomaly: "rbxassetid://85959311229276",
		Ghost: "rbxassetid://96170546434722",
		Shiny: "rbxassetid://130156391015583",
	},
	Lionfish: {
		Normal: "rbxassetid://136049057236963",
		Anomaly: "rbxassetid://128348629033015",
		Ghost: "rbxassetid://82334868775418",
		Shiny: "rbxassetid://111025640215018",
	},
	Dragonfish: {
		Normal: "rbxassetid://126100559241211",
		Anomaly: "rbxassetid://95244607905271",
		Ghost: "rbxassetid://104543312979275",
		Shiny: "rbxassetid://89883389934153",
	},
	WolfDogfish: {
		Normal: "rbxassetid://113379750149852",
		Anomaly: "rbxassetid://85231797584530",
		Ghost: "rbxassetid://118486190217943",
		Shiny: "rbxassetid://111147344409728",
	},
	BunnyShark: {
		Normal: "rbxassetid://107327208598706",
		Anomaly: "rbxassetid://122949860094205",
		Ghost: "rbxassetid://88194071263777",
		Shiny: "rbxassetid://118888539697471",
	},
	MiniLeviathan: {
		Normal: "rbxassetid://88991168701910",
		Anomaly: "rbxassetid://76326534871685",
		Ghost: "rbxassetid://102144531109970",
		Shiny: "rbxassetid://122761530150036",
	},
	// Easter egg: no variant, every column is its one icon
	FrenchFish: {
		Normal: FRENCH_FISH_ICON,
		Anomaly: FRENCH_FISH_ICON,
		Ghost: FRENCH_FISH_ICON,
		Shiny: FRENCH_FISH_ICON,
	},
	AlienFish: {
		Normal: ALIEN_FISH_ICON,
		Anomaly: ALIEN_FISH_ICON,
		Ghost: ALIEN_FISH_ICON,
		Shiny: ALIEN_FISH_ICON,
	},
};

/** A colour per aquarium theme (AquariumPanel's theme cards): its water / mood, light to dark. */
export const THEME_PALETTES: Record<AquariumTheme, Palette> = {
	Basic: palette("#9BD7FF", "#3EA0F0", "#2A78C0", "#14406E"),
	Lagoon: palette("#8AF7F9", "#00C2CB", "#00939C", "#005A61"),
	NeonCoral: palette("#FFB3D1", "#FF5C9A", "#D93A78", "#7A1240"),
	PirateWreck: palette("#E8C08A", "#B07A3C", "#8A5A2B", "#4A2E12"),
	Atlantis: palette("#B8F5E8", "#3FBFA8", "#2A9480", "#0F5246"),
	MarianaTrench: palette("#5A7FB8", "#25467A", "#162C52", "#060F24"),
	VolcanicTemple: palette("#FFA27A", "#E0502A", "#B0361A", "#5E1608"),
	CrystalCaverns: palette("#E2C4FF", "#A87CF0", "#7E55C8", "#3E2470"),
	CosmicSanctuary: palette("#9A7CFF", "#5A3CC8", "#3A2490", "#140A40"),
};

/** Face colours of a found variant's slot (FigCraft: ItemSlot_<Variant>). */
export const VARIANT_PALETTES: Record<FishVariant, Palette> = {
	Normal: PALETTES.blue,
	Anomaly: PALETTES.purple,
	Ghost: PALETTES.ghost,
	Shiny: PALETTES.gold,
};

/** Colour of each variant in the UI (Fish Index columns, Ocean rows, hatch reveal). */
export const VARIANT_STYLES: Record<FishVariant, { color: Color3 }> = {
	Normal: { color: Color3.fromHex("#8FA9B8") },
	Anomaly: { color: Color3.fromHex("#B36BFF") },
	Ghost: { color: Color3.fromHex("#9FE3FF") },
	Shiny: { color: Color3.fromHex("#FFD54A") },
};

export interface EggSprites {
	icon: string; // the whole egg (shop slot, start of the reveal)
	top: string; // shell halves of the broken egg, same 100x120 canvas as the whole egg
	bottom: string;
}

/** Egg sprites (design/ui/eggs.build.js -> FigCraft "Egg*" frames), exported at 2x and uploaded to Roblox. */
export const EGG_SPRITES: Record<EggType, EggSprites> = {
	Common: {
		icon: "rbxassetid://87954442400204", // CommonEgg.png
		top: "rbxassetid://101948679804742", // CommonEggTop.png
		bottom: "rbxassetid://134911713465469", // CommonEggBottom.png
	},
	Improved: {
		icon: "rbxassetid://130023858829178", // ImprovedEgg.png
		top: "rbxassetid://90033985531193", // ImprovedEggTop.png
		bottom: "rbxassetid://76029518596614", // ImprovedEggBottom.png
	},
	Superior: {
		icon: "rbxassetid://97024112173495", // SuperiorEgg.png
		top: "rbxassetid://85176306294336", // SuperiorEggTop.png
		bottom: "rbxassetid://84385417387057", // SuperiorEggBottom.png
	},
	Freshwater: {
		icon: "rbxassetid://71022821866321", // FreshwaterEgg.png
		top: "rbxassetid://86542346134128", // FreshwaterEggTop.png
		bottom: "rbxassetid://118584229875928", // FreshwaterEggBottom.png
	},
	Amazon: {
		icon: "rbxassetid://120404553501723", // AmazonEgg.png
		top: "rbxassetid://103004264880474", // AmazonEggTop.png
		bottom: "rbxassetid://75934866763815", // AmazonEggBottom.png
	},
	NeonCoral: {
		icon: "rbxassetid://116810397244589", // NeonCoralEgg.png
		top: "rbxassetid://111315255812037", // NeonCoralEggTop.png
		bottom: "rbxassetid://115315609561404", // NeonCoralEggBottom.png
	},
	Wreck: {
		icon: "rbxassetid://84536827686827", // WreckEgg.png
		top: "rbxassetid://99964963145652", // WreckEggTop.png
		bottom: "rbxassetid://85919710172325", // WreckEggBottom.png
	},
	Atlantis: {
		icon: "rbxassetid://84541280076735", // AtlantisEgg.png
		top: "rbxassetid://89395016235249", // AtlantisEggTop.png
		bottom: "rbxassetid://117180715649870", // AtlantisEggBottom.png
	},
	Trench: {
		icon: "rbxassetid://108031365345095", // TrenchEgg.png
		top: "rbxassetid://87982584203157", // TrenchEggTop.png
		bottom: "rbxassetid://109223152211260", // TrenchEggBottom.png
	},
	Volcano: {
		icon: "rbxassetid://74526808969308", // VolcanoEgg.png
		top: "rbxassetid://119121638443950", // VolcanoEggTop.png
		bottom: "rbxassetid://121990538528263", // VolcanoEggBottom.png
	},
	Crystal: {
		icon: "rbxassetid://136554331111983", // CrystalEgg.png
		top: "rbxassetid://119129075650820", // CrystalEggTop.png
		bottom: "rbxassetid://135259750384457", // CrystalEggBottom.png
	},
	Cosmic: {
		icon: "rbxassetid://120088132643070", // CosmicEgg.png
		top: "rbxassetid://106958821477467", // CosmicEggTop.png
		bottom: "rbxassetid://77857068011328", // CosmicEggBottom.png
	},
};

/** Crack overlays drawn over any egg while it hatches, from a small crack to the break line. */
export const EGG_CRACKS = [
	"rbxassetid://130847269693895", // EggCrack1.png
	"rbxassetid://89299325411569", // EggCrack2.png
	"rbxassetid://123331170030954", // EggCrack3.png
] as const;

export interface Rarity {
	label: string;
	color: Color3;
}

/** Rarity colours (FigCraft: FishIndexPanel rarity chips). */
export const RARITY_STYLES: Record<FishRarity, Rarity> = {
	Common: { label: "COMMON", color: Color3.fromHex("#CFE8F0") },
	Uncommon: { label: "UNCOMMON", color: Color3.fromHex("#5BE37D") },
	Rare: { label: "RARE", color: Color3.fromHex("#4FB3FF") },
	Epic: { label: "EPIC", color: Color3.fromHex("#C08BFF") },
	Legendary: { label: "LEGENDARY", color: Color3.fromHex("#FFC93C") },
	Mythic: { label: "MYTHIC", color: Color3.fromHex("#FF5C8A") },
	Secret: { label: "SECRET", color: Color3.fromHex("#5C8DFF") }, // easter eggs (French blue)
};

/** Rarity of a fish type (FishConfig.rarity), with its UI colour. */
export function getFishRarity(fishType: FishType): Rarity {
	return RARITY_STYLES[FISH_TYPES[fishType].rarity];
}

/** Closed gate shown in the porthole of an egg the player hasn't unlocked yet (design/ui/gate.build.js). */
export const GATE_ICON = "rbxassetid://102158559192579"; // LockedGate.png

/** Stage colours of the K-pop event (FigCraft: EventBanner), cycled on the beat by the banner and the guest's effects. */
export const STAGE_COLORS = [
	Color3.fromHex("#FF4FD8"), // hot pink
	Color3.fromHex("#9B5CFF"), // violet
	Color3.fromHex("#33E1FF"), // cyan
	Color3.fromHex("#FFE14D"), // yellow
];

export const EVENT_COLORS = {
	bannerTop: Color3.fromHex("#3A1466"),
	bannerBottom: Color3.fromHex("#14072A"),
	subtitle: Color3.fromHex("#F3C6FF"),
	testButtonBg: Color3.fromHex("#0D1D26"),
};

/** Abyssal raid: banner, the tanks' abyss backdrop and the lantern fish (AbyssEventController). */
export const ABYSS_COLORS = {
	bannerTop: Color3.fromHex("#0E2A45"),
	bannerBottom: Color3.fromHex("#02070F"),
	subtitle: Color3.fromHex("#9FE8FF"),
	/** The lantern's cold glow (lure light) and its red eyes: the banner glows from one to the other. */
	lure: Color3.fromHex("#9CFFEA"),
	eye: Color3.fromHex("#FF4A3D"),
	backdropTop: Color3.fromHex("#0B2340"),
	backdropMiddle: Color3.fromHex("#05122A"),
	backdropBottom: Color3.fromHex("#010409"),
	rock: Color3.fromHex("#02060D"),
	rockFar: Color3.fromHex("#06132A"),
	specks: [
		Color3.fromHex("#3FF2D0"),
		Color3.fromHex("#58A6FF"),
		Color3.fromHex("#B98CFF"),
		Color3.fromHex("#9FE8FF"),
	],
	snow: Color3.fromHex("#CFE6FF"),
	water: Color3.fromHex("#0A1A38"),
	tankLight: Color3.fromHex("#7FA8FF"),
};

/** The UFO night (UfoEventController): deep space behind the tank, green alien light. */
export const UFO_COLORS = {
	bannerTop: Color3.fromHex("#2B1458"),
	bannerBottom: Color3.fromHex("#07051A"),
	subtitle: Color3.fromHex("#B8FFB0"),
	/** The UFO's green beam and its pink dome lights: the banner glows from one to the other. */
	beam: Color3.fromHex("#5CFF7A"),
	dome: Color3.fromHex("#FF7AD9"),
	backdropTop: Color3.fromHex("#1A0B3D"),
	backdropMiddle: Color3.fromHex("#0C0827"),
	backdropBottom: Color3.fromHex("#030212"),
	nebula: [Color3.fromHex("#7A3CFF"), Color3.fromHex("#FF4FB8"), Color3.fromHex("#2EC5FF")],
	stars: [Color3.fromHex("#FFFFFF"), Color3.fromHex("#FFF3B0"), Color3.fromHex("#BDE3FF")],
	planets: [
		{ top: Color3.fromHex("#FFB35C"), bottom: Color3.fromHex("#C2410C"), ring: Color3.fromHex("#FFE2B0") },
		{ top: Color3.fromHex("#7CF0C8"), bottom: Color3.fromHex("#127A6B") },
		{ top: Color3.fromHex("#C9A8FF"), bottom: Color3.fromHex("#5B2AA8") },
	],
	water: Color3.fromHex("#0B1530"),
	tankLight: Color3.fromHex("#6BFF8A"),
	spot: Color3.fromHex("#4DFF6A"),
	/** Mutations of the fish it brings back (aura particles and light). */
	auraGreen: Color3.fromHex("#4DFF6A"),
	auraRed: Color3.fromHex("#FF3B3B"),
	sleep: Color3.fromHex("#BFD8FF"),
};

/** Look of the event banner, per kind of event: music events flash on the beat, the raid glows slowly. */
export const EVENT_BANNER_STYLES = {
	Music: {
		top: EVENT_COLORS.bannerTop,
		bottom: EVENT_COLORS.bannerBottom,
		subtitle: EVENT_COLORS.subtitle,
		accents: STAGE_COLORS,
	},
	Abyss: {
		top: ABYSS_COLORS.bannerTop,
		bottom: ABYSS_COLORS.bannerBottom,
		subtitle: ABYSS_COLORS.subtitle,
		accents: [ABYSS_COLORS.lure, ABYSS_COLORS.eye],
	},
	Ufo: {
		top: UFO_COLORS.bannerTop,
		bottom: UFO_COLORS.bannerBottom,
		subtitle: UFO_COLORS.subtitle,
		accents: [UFO_COLORS.beam, UFO_COLORS.dome],
	},
};

/** The Ocean (FigCraft: OceanPanel, OceanCoach, PanelCoach): released fish and Ocean Points. */
export const OCEAN_COLORS = {
	top: Color3.fromHex("#1FA9C9"),
	bottom: Color3.fromHex("#0B5C7A"),
	light: Color3.fromHex("#7FF0FF"),
};

/** Like boards beside the aquariums and the owner's boost pill (FigCraft: LikeBoard, LikeBoostPill): beach palette. */
export const LIKE_COLORS = {
	boardTop: Color3.fromHex("#F6F1E7"),
	boardBottom: Color3.fromHex("#E9DCC2"),
	boardStroke: Color3.fromHex("#9C7A4C"),
	title: Color3.fromHex("#17707F"),
	count: Color3.fromHex("#1E3A40"),
	hint: Color3.fromHex("#8A6A3E"),
	coralTop: Color3.fromHex("#FF9A7E"),
	coral: Color3.fromHex("#FF7A5C"),
	coralStroke: Color3.fromHex("#C9503A"),
	pill: Color3.fromHex("#0D1D26"),
};

/** Rebirth menu (FigCraft: RebirthPanel): the multiplier "hero" card, progress and buttons. */
export const REBIRTH_COLORS = {
	heroText: Color3.fromHex("#6B3A0E"),
	heroTextStroke: Color3.fromHex("#8A4A12"),
};
