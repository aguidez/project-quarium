// Audio assets (Creator Store / the owner's inventory). Swap an id here to change a sound.

/** Background music, looped ("Feeding Time at the Reef"). */
export const MUSIC_ID = "rbxassetid://109430872491235";

/** One effect: its id and volume; `region`: only that part of it plays ([start, end] in seconds); `fallback`: the id
 * played instead when it can't load (a player's upload Roblox took down). */
export interface SfxConfig {
	id: string;
	volume: number;
	region?: readonly [number, number];
	fallback?: string;
}

/**
 * Short effects requested by the server and played by the client in 2D (not positional):
 * the focus camera sits far from the tank, so a 3D sound would be inaudible.
 */
export const SFX = {
	/** A fish eats a food pellet ("Cartoon Pop" by Daily Sounds). */
	EatFood: { id: "rbxassetid://106984966606682", volume: 0.7 },
	/** A starving fish swallows a smaller one ("Bubble Pops" by Daily Sounds). */
	EatFish: { id: "rbxassetid://86074928120719", volume: 0.7 },
	/** A fish released to the ocean swims away ("Bubble Pops" by Daily Sounds, played higher). */
	FishReleased: { id: "rbxassetid://86074928120719", volume: 0.7 },
	/** A fish turned weak with hunger ("Power Down" by Daily Sounds, a cartoon "lost a life"). */
	FishWeak: { id: "rbxassetid://96795857757261", volume: 0.5 },
	/** A weak fish lets out a bubble ("Underwater Bubbles Deeper Med Short Bursts 6" by Pro Sound Effects). */
	WeakBubble: { id: "rbxassetid://9120310416", volume: 0.5 },
	/** The player collects a coin ("Coin Pickup" by Daily Sounds): pitched up while coins are chained (CoinService). */
	CoinCollect: { id: "rbxassetid://130378474223829", volume: 0.2 },
	/** A companion picks a coin up: the same chime, softer, so an AFK tank doesn't ring all the time. */
	CompanionCoin: { id: "rbxassetid://130378474223829", volume: 0.07 },
	/** A fart bubble is clicked ("cartoon bubble pop" by ad0xsus). */
	BubblePop: { id: "rbxassetid://109359226723492", volume: 0.6 },
	/** One crack of a hatching egg, played at each crack stage ("egg crack 2"). */
	EggCrack: { id: "rbxassetid://126409451844008", volume: 0.8 },
	/** The egg breaks open ("Egg hatching Sound" by CaspDaPast Studios). */
	EggHatch: { id: "rbxassetid://121871959493028", volume: 0.7 },
	/** Congratulation jingle: a hatched fish revealed, a reward popup (the owner's "Achievement"; the old "TaDa" if it
	 * can't load). Its file is mixed ~3x quieter than the TaDa (PlaybackLoudness peak 76 vs 248), hence the volume. */
	FishObtained: { id: "rbxassetid://106569108654071", volume: 3.5, fallback: "rbxassetid://4757565956" },
	/** A menu opens, or another one replaces it: one of the owner's two takes, picked at random (App). The four menu
	 * clicks have uneven files (peaks 41 / 86 / 50 / 120): each volume brings them to the same ~125. */
	MenuOpen1: { id: "rbxassetid://75564118684402", volume: 3 },
	MenuOpen2: { id: "rbxassetid://93172061244688", volume: 1.5 },
	/** A menu closes: one of the owner's two takes, picked at random (App). */
	MenuClose1: { id: "rbxassetid://90572052538966", volume: 2.5 },
	MenuClose2: { id: "rbxassetid://88093077578000", volume: 1.1 },
	/** The lantern fish of the abyssal raid snatches a coin ("Bubble Pops" by Daily Sounds, played low: a gulp). */
	CoinStolen: { id: "rbxassetid://86074928120719", volume: 0.8 },
	/** A UFO beams a fish up or drops it back ("Fun & Quirky - Space tones" by APM Music): kept low under the event's music. */
	UfoBeam: { id: "rbxassetid://1841186034", volume: 0.12 },
	/**
	 * The alien fish screams: the whole tank drops a coin. The owner's "tchiki" (from "Dédicace à mon coach Allan tchiki
	 * brrr" by 28octobre1995, its first word: 2.65-3.32 s, cut in the silences measured with an AudioAnalyzer); the old
	 * scream ("Robot Vocals Phasey Scrambled Speech 17" by Pro Sound Effects) if it can't load.
	 */
	AlienScream: {
		id: "rbxassetid://111879126483660",
		volume: 0.8,
		region: [2.65, 3.32],
		fallback: "rbxassetid://9118515692",
	},
	/** A falling star of the starfall is caught ("bling_diamond_pickup_2"): pitched up as the star gauge fills. */
	StarCatch: { id: "rbxassetid://4612374393", volume: 0.5 },
	/** A new onboarding instruction shows up ("Mouth Pop" by Daily Sounds). */
	OnboardingStep: { id: "rbxassetid://131626394188859", volume: 0.6 },
} as const satisfies Record<string, SfxConfig>;

export type SfxName = keyof typeof SFX;
