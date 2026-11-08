import { CollectionService, RunService } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { TAGS } from "shared/tags";

// The colours each glowing finish drifts through, in a loop (the rim's "RimFinish" attribute)
const PALETTES: Record<string, Color3[]> = {
	// the northern lights
	Aurora: [
		Color3.fromHex("#5CF2C0"), // green
		Color3.fromHex("#3CD6E6"), // teal
		Color3.fromHex("#5C8CFF"), // blue
		Color3.fromHex("#A97CFF"), // violet
		Color3.fromHex("#FF8AD8"), // pink
	],
	// the Galaxy variant's night: deep violet and blue, a pink nebula, a bright star blue
	Galaxy: [
		Color3.fromHex("#3A2490"),
		Color3.fromHex("#5A3CC8"),
		Color3.fromHex("#FF60C8"),
		Color3.fromHex("#46C8FF"),
		Color3.fromHex("#2A1A7A"),
	],
};
const CYCLE_TIME = 10; // seconds for the whole loop of colours
const RIM_OFFSET = 0.12; // each rim of a tank a little ahead of the previous one (fraction of the loop)
const UPDATE_INTERVAL = 1 / 20; // seconds: a slow drift needs no more than 20 updates a second

/**
 * The glowing rims cosmetics (V1.2: the Aurora rims, Ocean 14,000,000; the Galaxy rims, Collector 100 cells): the server
 * makes the rims Neon and tags them GlowRim with their finish (AquariumService.applyTheme); every client drifts their
 * colour through that finish's palette. Purely visual.
 */
class AuroraRimsControllerSingleton implements Lifecycle {
	private rims = new Map<BasePart, number>(); // rim -> its phase offset
	private elapsed = 0;

	public onInit() {
		CollectionService.GetInstanceAddedSignal(TAGS.GlowRim).Connect((rim) => this.track(rim));
		CollectionService.GetInstanceRemovedSignal(TAGS.GlowRim).Connect((rim) => this.rims.delete(rim as BasePart));
		for (const rim of CollectionService.GetTagged(TAGS.GlowRim)) this.track(rim);
	}

	public onStart() {
		print("[Client] AuroraRimsController started.");
		RunService.Heartbeat.Connect((dt) => {
			this.elapsed += dt;
			if (this.elapsed < UPDATE_INTERVAL || this.rims.size() === 0) return;
			this.elapsed = 0;
			const loop = (os.clock() / CYCLE_TIME) % 1;
			for (const [rim, offset] of this.rims) {
				const palette = PALETTES[rim.GetAttribute("RimFinish") as string] ?? PALETTES.Aurora;
				rim.Color = this.colorAt(palette, (loop + offset) % 1);
			}
		});
	}

	private track(instance: Instance) {
		if (!instance.IsA("BasePart")) return;
		const index = ["RimFront", "RimRight", "RimBack", "RimLeft"].indexOf(instance.Name);
		this.rims.set(instance, math.max(index, 0) * RIM_OFFSET);
	}

	/** The colour at `t` (0..1) of the loop, eased between two neighbours. */
	private colorAt(palette: Color3[], t: number): Color3 {
		const count = palette.size();
		const position = t * count;
		const index = math.floor(position);
		const k = position - index;
		const eased = k * k * (3 - 2 * k);
		return palette[index % count].Lerp(palette[(index + 1) % count], eased);
	}
}

export const AuroraRimsController = new AuroraRimsControllerSingleton();
