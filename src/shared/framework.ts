export interface Lifecycle {
	onInit?(): void;
	onStart?(): void;
}

export function bootstrap(modules: Lifecycle[]) {
	// Phase 1: synchronous init
	for (const mod of modules) {
		mod.onInit?.();
	}

	// Phase 2: asynchronous start
	for (const mod of modules) {
		task.spawn(() => {
			mod.onStart?.();
		});
	}
}