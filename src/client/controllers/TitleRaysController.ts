import { CollectionService, RunService } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { TAGS } from "shared/tags";

/** The rays sway around their resting angle, each on its own phase. */
const SWAY_DEGREES = 5;
const SWAY_PERIOD = 2.4;
/** And shimmer: each one fades a little in and out. */
const SHIMMER_PERIOD = 1.4;
const SHIMMER_DEPTH = 0.35;

/**
 * The sun rays of the creator's title (TitleService: Frames tagged TitleRay, attributes Angle and Phase), lit from
 * the whole word: each client sways them gently around their angle and makes them shimmer, every frame, so the light
 * moves smoothly for every viewer (a server change would replicate in steps).
 */
class TitleRaysControllerSingleton implements Lifecycle {
	public onInit() {}

	public onStart() {
		print("[Client] TitleRaysController started.");
		RunService.RenderStepped.Connect(() => {
			const rays = CollectionService.GetTagged(TAGS.TitleRay);
			if (rays.size() === 0) return;
			const clock = os.clock();
			for (const ray of rays) {
				if (!ray.IsA("Frame")) continue;
				const angle = ray.GetAttribute("Angle");
				const index = ray.GetAttribute("Phase");
				const base = typeIs(angle, "number") ? angle : 0;
				const phase = typeIs(index, "number") ? index * 1.3 : 0;
				ray.Rotation = base + math.sin((clock / SWAY_PERIOD) * math.pi * 2 + phase) * SWAY_DEGREES;
				ray.BackgroundTransparency =
					((math.sin((clock / SHIMMER_PERIOD) * math.pi * 2 + phase * 1.7) + 1) / 2) * SHIMMER_DEPTH;
			}
		});
	}
}

export const TitleRaysController = new TitleRaysControllerSingleton();
