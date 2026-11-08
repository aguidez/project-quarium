import { CollectionService, RunService } from "@rbxts/services";
import { Lifecycle } from "shared/framework";
import { TAGS } from "shared/tags";

/** One pulse of the aura, in seconds, and how far it swells. */
const PULSE_PERIOD = 1.6;
const THICKNESS = { min: 5, max: 10 };
const TRANSPARENCY = { min: 0.35, max: 0.75 };

/**
 * The aura of the creator's title (TitleService: a UIStroke tagged TitleAura behind the red letters): each client
 * swells and fades it on a slow sine, so it breathes smoothly for every viewer (a server tween would replicate in steps).
 */
class TitleAuraControllerSingleton implements Lifecycle {
	public onInit() {}

	public onStart() {
		print("[Client] TitleAuraController started.");
		RunService.RenderStepped.Connect(() => {
			const auras = CollectionService.GetTagged(TAGS.TitleAura);
			if (auras.size() === 0) return;
			const wave = (math.sin((os.clock() / PULSE_PERIOD) * math.pi * 2) + 1) / 2; // 0 to 1
			for (const aura of auras) {
				if (!aura.IsA("UIStroke")) continue;
				aura.Thickness = THICKNESS.min + (THICKNESS.max - THICKNESS.min) * wave;
				aura.Transparency = TRANSPARENCY.max - (TRANSPARENCY.max - TRANSPARENCY.min) * wave;
			}
		});
	}
}

export const TitleAuraController = new TitleAuraControllerSingleton();
