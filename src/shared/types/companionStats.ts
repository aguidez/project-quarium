import {
	CompanionType,
	JELLYFISH_CHARGES,
	JELLYFISH_FEED_INTERVAL,
	JELLYFISH_PELLETS,
	PELICAN_FEED_INTERVAL,
	SWORDFISH_REACH,
	SWORDFISH_SPEED,
	HERMIT_CRAB_LUCK,
	WATER_HEN_HATCH_MULTIPLIER,
} from "./companions";
import { getCompanionMultiplier } from "./oceanRewards";
import {
	getJellyfishStats,
	getPelicanCharges,
	getPelicanPellets,
	getCrabFullLuck,
	getPerkHatchMultiplier,
	getSwordfishStats,
	Perk,
} from "./perks";

/** "7.5", "6", "2.5": short numbers for the companion cards (one decimal). */
function short(value: number): string {
	return tostring(math.floor(value * 10 + 0.5) / 10);
}

function percent(multiplier: number): string {
	return `${math.floor(multiplier * 100 + 0.5)}%`;
}

/**
 * What a companion does right now for this player, with the bonuses of its own (Ocean upgrades, its quest perks):
 * the line under its ability on the companion card. Player-wide perks earned on its quest line (lasting / bouncy
 * coins, Hearty meals) work without it, so they are not shown here. The same numbers the server plays with (CompanionService,
 * EggService, CoinService).
 */
export function getCompanionStats(
	companion: CompanionType,
	data: { perks: readonly Perk[]; oceanRewardsClaimed: readonly string[] },
): string {
	const perks = data.perks;
	if (companion === "Snail") {
		// Its quest perks (lasting / bouncy coins) work without it: not its own numbers
		return `Speed ${percent(getCompanionMultiplier(data.oceanRewardsClaimed, "Snail"))}`;
	}
	if (companion === "Pelican") {
		const interval = PELICAN_FEED_INTERVAL / getCompanionMultiplier(data.oceanRewardsClaimed, "Pelican");
		const pellets = getPelicanPellets(perks);
		const charges = getPelicanCharges(perks);
		const parts = [`Every ${short(interval)} s`, `${pellets} pellet${pellets > 1 ? "s" : ""}`];
		if (charges > 0) parts.push(`${charges} charges, on demand`);
		// Hearty meals (fish full longer, the shrimp food) works without it: not its own number
		return parts.join(" · ");
	}
	if (companion === "WaterHen") {
		const multiplier = getPerkHatchMultiplier(perks) ?? WATER_HEN_HATCH_MULTIPLIER;
		return `Eggs hatch ${percent(1 - multiplier)} faster while equipped`;
	}
	if (companion === "HermitCrab") {
		const luck = math.floor(getCrabFullLuck(perks, HERMIT_CRAB_LUCK) * 100 + 0.5) / 100; // x1.25, x1.35: two decimals
		return `Rare variants x${luck} on the eggs that incubate with it`;
	}
	if (companion === "Swordfish") {
		const stats = getSwordfishStats(perks, SWORDFISH_SPEED, SWORDFISH_REACH);
		return `Speed ${percent(stats.speed / SWORDFISH_SPEED)} · reach ${short(stats.reach)} studs`;
	}
	const stats = getJellyfishStats(perks, {
		charges: JELLYFISH_CHARGES,
		interval: JELLYFISH_FEED_INTERVAL,
		pellets: JELLYFISH_PELLETS,
	});
	return `A charge every ${short(stats.interval)} s · ${stats.charges} charges · ${stats.pellets} pellets`;
}
