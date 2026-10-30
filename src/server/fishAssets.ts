import { CollectionService, ReplicatedStorage, ServerStorage } from "@rbxts/services";
import { TAGS } from "shared/tags";
import { FishType } from "shared/types/fish";
import { FishVariant, RECOLOURED_VARIANTS } from "shared/types/variants";

/** A species gone from every tank stays replicated this long: a release and a hatch don't reload it. */
const UNUSED_GRACE = 60;

/**
 * On-demand fish templates (PROJECT_CONTEXT §4): the species' models (tag FishTemplate) and their variants'
 * textures (tag FishVariantAppearance) live in ServerStorage.Assets, so a client only downloads the species
 * that swim on its server, not all of them. A copy goes to ReplicatedStorage.Assets.Fish / FishVariants
 * (same names as before) when a fish of that species / variant spawns, before the clients hear of it, and
 * is removed once none has been left on the server for UNUSED_GRACE seconds (FishService sweeps).
 */
class FishAssetsRegistry {
	private templates = new Map<FishType, Model>();
	/** Key `${fishType}_${variant}`, recoloured variants only (a ghost is drawn by the client). */
	private appearances = new Map<string, SurfaceAppearance>();
	/** The copies in ReplicatedStorage, by key (a FishType alone, or `${fishType}_${variant}`). */
	private replicated = new Map<string, Instance>();
	/** When each replicated key was last seen in use. */
	private usedAt = new Map<string, number>();
	private fishFolder?: Folder;
	private variantFolder?: Folder;

	/** `templates`: the species' models found in ServerStorage (FishService's loadTemplates). */
	public init(templates: Map<FishType, Model>) {
		this.templates = templates;
		for (const instance of CollectionService.GetTagged(TAGS.FishVariantAppearance)) {
			if (!instance.IsA("SurfaceAppearance") || !instance.IsDescendantOf(ServerStorage)) continue;
			const fishType = instance.GetAttribute("FishType");
			const variant = instance.GetAttribute("Variant");
			if (typeIs(fishType, "string") && typeIs(variant, "string"))
				this.appearances.set(`${fishType}_${variant}`, instance);
		}
		const assets = this.getFolder(ReplicatedStorage, "Assets");
		this.fishFolder = this.getFolder(assets, "Fish");
		this.variantFolder = this.getFolder(assets, "FishVariants");
	}

	/** Makes the species (and its variant's texture) available to the clients. Call it before they hear of the fish. */
	public require(fishType: FishType, variant: FishVariant) {
		const now = os.clock();
		this.usedAt.set(fishType, now);
		if (!this.replicated.has(fishType)) {
			const template = this.templates.get(fishType);
			if (template) this.replicate(fishType, template, this.fishFolder);
		}
		if (!RECOLOURED_VARIANTS.includes(variant)) return;
		const key = `${fishType}_${variant}`;
		this.usedAt.set(key, now);
		if (!this.replicated.has(key)) {
			const appearance = this.appearances.get(key);
			if (appearance) this.replicate(key, appearance, this.variantFolder);
		}
	}

	/**
	 * `inUse`: the keys of the fish alive on the server (a FishType, and `${fishType}_${variant}` for the
	 * recoloured ones). Copies unused for UNUSED_GRACE are removed: the clients drop them too.
	 */
	public sweep(inUse: ReadonlySet<string>) {
		const now = os.clock();
		for (const [key, copy] of this.replicated) {
			if (inUse.has(key)) {
				this.usedAt.set(key, now);
			} else if (now - (this.usedAt.get(key) ?? 0) > UNUSED_GRACE) {
				copy.Destroy();
				this.replicated.delete(key);
				this.usedAt.delete(key);
			}
		}
	}

	private replicate(key: string, source: Instance, folder?: Folder) {
		const copy = source.Clone(); // keeps its tag and attributes: the clients find it the same way
		copy.Parent = folder;
		this.replicated.set(key, copy);
	}

	private getFolder(parent: Instance, name: string): Folder {
		const existing = parent.FindFirstChild(name);
		if (existing?.IsA("Folder")) return existing;
		const folder = new Instance("Folder");
		folder.Name = name;
		folder.Parent = parent;
		return folder;
	}
}

export const FishAssets = new FishAssetsRegistry();
