import { CollectionService, RunService } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { TAGS } from "shared/tags";

/** Degrees a second the sun rays turn. */
const TURN_SPEED = 14;
/** The rays shimmer: each one fades a little in and out, on its own phase. */
const SHIMMER_PERIOD = 1.4;
const SHIMMER_DEPTH = 0.35;

/**
 * The sun rays behind the creator's title (TitleService: Frames tagged TitleRay, attribute "Angle"): each client turns
 * them slowly and makes them shimmer, every frame, so the burst moves smoothly for every viewer (a server change would
 * replicate in steps).
 */
class TitleRaysControllerSingleton implements Lifecycle {
	public onInit() {}

	public onStart() {
		print("[Client] TitleRaysController started.");
		RunService.RenderStepped.Connect(() => {
			const rays = CollectionService.GetTagged(TAGS.TitleRay);
			if (rays.size() === 0) return;
			const clock = os.clock();
			const turn = (clock * TURN_SPEED) % 360;
			for (const ray of rays) {
				if (!ray.IsA("Frame")) continue;
				const angle = ray.GetAttribute("Angle");
				const base = typeIs(angle, "number") ? angle : 0;
				ray.Rotation = base + turn;
				const phase = (base / 180) * math.pi * 2;
				ray.BackgroundTransparency =
					((math.sin((clock / SHIMMER_PERIOD) * math.pi * 2 + phase) + 1) / 2) * SHIMMER_DEPTH;
			}
		});
	}
}

export const TitleRaysController = new TitleRaysControllerSingleton();
