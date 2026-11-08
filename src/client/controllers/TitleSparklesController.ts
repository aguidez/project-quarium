import { CollectionService, RunService } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { TAGS } from "shared/tags";

/** One twinkle of a sparkle, in seconds: it grows, shines and fades out, then rests until its next turn. */
const TWINKLE_PERIOD = 2.2;
/** The share of the period a sparkle shows (the rest it is gone), so they light up in turn. */
const SHOWN_SHARE = 0.55;
/** How far apart the sparkles' turns are (a share of the period per sparkle, wrapping). */
const PHASE_STEP = 0.37;

/**
 * The sparkles around the creator's title (TitleService: square Frames tagged TitleSparkle, attributes Size and
 * Phase): each client makes them twinkle in turn, growing from nothing to their full size and back, every frame,
 * so they move smoothly for every viewer (a server change would replicate in steps).
 */
class TitleSparklesControllerSingleton implements Lifecycle {
	public onInit() {}

	public onStart() {
		print("[Client] TitleSparklesController started.");
		RunService.RenderStepped.Connect(() => {
			const sparkles = CollectionService.GetTagged(TAGS.TitleSparkle);
			if (sparkles.size() === 0) return;
			const clock = os.clock();
			for (const sparkle of sparkles) {
				if (!sparkle.IsA("Frame")) continue;
				const size = sparkle.GetAttribute("Size");
				const index = sparkle.GetAttribute("Phase");
				if (!typeIs(size, "number")) continue;
				const phase = typeIs(index, "number") ? index * PHASE_STEP : 0;
				const cycle = (clock / TWINKLE_PERIOD + phase) % 1; // 0 to 1
				// Shown during the first SHOWN_SHARE of its cycle: a smooth rise and fall, nothing the rest of the time
				const scale = cycle < SHOWN_SHARE ? math.sin((cycle / SHOWN_SHARE) * math.pi) : 0;
				sparkle.Size = UDim2.fromScale(size * scale, 1);
				sparkle.Visible = scale > 0.02;
			}
		});
	}
}

export const TitleSparklesController = new TitleSparklesControllerSingleton();
