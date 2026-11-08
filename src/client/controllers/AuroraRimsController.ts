import { CollectionService, RunService } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { TAGS } from "shared/tags";

// The northern lights' colours the rims drift through, in a loop
const AURORA_COLORS = [
	Color3.fromHex("#5CF2C0"), // green
	Color3.fromHex("#3CD6E6"), // teal
	Color3.fromHex("#5C8CFF"), // blue
	Color3.fromHex("#A97CFF"), // violet
	Color3.fromHex("#FF8AD8"), // pink
];
const CYCLE_TIME = 10; // seconds for the whole loop of colours
const RIM_OFFSET = 0.12; // each rim of a tank a little ahead of the previous one (fraction of the loop)
const UPDATE_INTERVAL = 1 / 20; // seconds: a slow drift needs no more than 20 updates a second

/**
 * The Aurora rims cosmetic (V1.2, Ocean 14,000,000): the server makes the rims Neon and tags them AuroraRim
 * (AquariumService.applyTheme); every client drifts their colour through the northern lights' colours. Purely visual.
 */
class AuroraRimsControllerSingleton implements Lifecycle {
	private rims = new Map<BasePart, number>(); // rim -> its phase offset
	private elapsed = 0;

	public onInit() {
		CollectionService.GetInstanceAddedSignal(TAGS.AuroraRim).Connect((rim) => this.track(rim));
		CollectionService.GetInstanceRemovedSignal(TAGS.AuroraRim).Connect((rim) => this.rims.delete(rim as BasePart));
		for (const rim of CollectionService.GetTagged(TAGS.AuroraRim)) this.track(rim);
	}

	public onStart() {
		print("[Client] AuroraRimsController started.");
		RunService.Heartbeat.Connect((dt) => {
			this.elapsed += dt;
			if (this.elapsed < UPDATE_INTERVAL || this.rims.size() === 0) return;
			this.elapsed = 0;
			const loop = (os.clock() / CYCLE_TIME) % 1;
			for (const [rim, offset] of this.rims) rim.Color = this.colorAt((loop + offset) % 1);
		});
	}

	private track(instance: Instance) {
		if (!instance.IsA("BasePart")) return;
		const index = ["RimFront", "RimRight", "RimBack", "RimLeft"].indexOf(instance.Name);
		this.rims.set(instance, math.max(index, 0) * RIM_OFFSET);
	}

	/** The colour at `t` (0..1) of the loop, eased between two neighbours. */
	private colorAt(t: number): Color3 {
		const count = AURORA_COLORS.size();
		const position = t * count;
		const index = math.floor(position);
		const k = position - index;
		const eased = k * k * (3 - 2 * k);
		return AURORA_COLORS[index % count].Lerp(AURORA_COLORS[(index + 1) % count], eased);
	}
}

export const AuroraRimsController = new AuroraRimsControllerSingleton();
