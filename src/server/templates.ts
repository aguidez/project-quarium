import { CollectionService, TweenService } from "@rbxts/services";

/**
 * Collects the Studio-made template models carrying `tag`, indexed by their `attribute`
 * value (e.g. FishType). Warns about invalid templates and about missing keys.
 */
export function loadTemplates<K extends string>(tag: string, attribute: string, keys: readonly K[]): Map<K, Model> {
	const templates = new Map<K, Model>();
	for (const instance of CollectionService.GetTagged(tag)) {
		const key = instance.GetAttribute(attribute);
		if (!instance.IsA("Model") || !instance.PrimaryPart || !typeIs(key, "string") || !keys.includes(key as K)) {
			warn(`[Server] Template "${instance.GetFullName()}" ignored: needs a PrimaryPart and a valid "${attribute}".`);
			continue;
		}
		templates.set(key as K, instance);
	}
	for (const key of keys) {
		if (!templates.has(key)) warn(`[Server] Missing template with tag "${tag}" and ${attribute}="${key}".`);
	}
	return templates;
}

/** Eases the model's scale from `from` to `to` over `duration` (yields). */
export function scaleModel(model: Model, from: number, to: number, duration: number, style: Enum.EasingStyle) {
	const start = os.clock();
	while (model.Parent) {
		const alpha = math.min((os.clock() - start) / duration, 1);
		model.ScaleTo(from + (to - from) * TweenService.GetValue(alpha, style, Enum.EasingDirection.Out));
		if (alpha >= 1) return;
		task.wait();
	}
}
