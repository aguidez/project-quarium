import { CollectionService, RunService } from "@rbxts/services";
import { TAGS } from "shared/tags";
import { FishType } from "shared/types/fish";
import { FISH_VARIANTS, FishVariant, RECOLOURED_VARIANTS } from "shared/types/variants";

// How a fish model looks in each variant (FishRenderController; any future 3D view of a fish should use it
// too): Anomaly / Shiny wear a recoloured texture, a ghost is pale and see-through
const GHOST_TRANSPARENCY = 0.5;
const GHOST_TINT = Color3.fromRGB(185, 235, 255);
const GHOST_TINT_AMOUNT = 0.55;
const SPARKLE_TEXTURE = "rbxasset://textures/particles/sparkles_main.dds";
const SPARKLE_COLOR = new ColorSequence(Color3.fromRGB(255, 245, 190), Color3.fromRGB(255, 255, 255));
// Galaxy (V1.1.20; design/previews/galaxy-animated-preview.gif): its night-sky texture breathes between a violet and a
// blue (a multiply tint, GALAXY_PULSE seconds a cycle), white stars twinkle on the body and a shooting star crosses it
// now and then. Only Galaxy fish pay for it, and they are rare.
const GALAXY_PULSE = 3;
const GALAXY_VIOLET = Color3.fromRGB(255, 212, 250);
const GALAXY_BLUE = Color3.fromRGB(212, 225, 255);
const GALAXY_STAR_COLOR = new ColorSequence(Color3.fromRGB(255, 255, 255), Color3.fromRGB(190, 210, 255));

const templates = new Map<FishType, Model>();
const missing = new Set<string>();

function warnOnce(key: string, message: string) {
	if (missing.has(key)) return;
	missing.add(key);
	warn(message);
}

/**
 * Template of a fish type (tagged FishTemplate). The server copies it into ReplicatedStorage.Assets.Fish only
 * while that species swims on the server (server/fishAssets): undefined until it has arrived.
 */
export function getFishTemplate(fishType: FishType): Model | undefined {
	const cached = templates.get(fishType);
	if (cached && cached.Parent) return cached;
	for (const instance of CollectionService.GetTagged(TAGS.FishTemplate)) {
		if (instance.IsA("Model") && instance.PrimaryPart && instance.GetAttribute("FishType") === fishType) {
			templates.set(fishType, instance);
			return instance;
		}
	}
	return undefined;
}

/** Recoloured SurfaceAppearance of a variant (tagged FishVariantAppearance, copied on demand like the templates). */
function findVariantAppearance(fishType: FishType, variant: FishVariant): SurfaceAppearance | undefined {
	for (const instance of CollectionService.GetTagged(TAGS.FishVariantAppearance)) {
		if (
			instance.IsA("SurfaceAppearance") &&
			instance.GetAttribute("FishType") === fishType &&
			instance.GetAttribute("Variant") === variant
		) {
			return instance;
		}
	}
	return undefined;
}

/** Whether everything the variant's look needs is here (a recoloured texture for Anomaly / Shiny). */
export function hasVariantLook(fishType: FishType, variant: FishVariant): boolean {
	return !RECOLOURED_VARIANTS.includes(variant) || findVariantAppearance(fishType, variant) !== undefined;
}

/** Calls back whenever a fish template or variant texture arrives from the server. */
export function onFishAssetAdded(callback: () => void): RBXScriptConnection[] {
	return [
		CollectionService.GetInstanceAddedSignal(TAGS.FishTemplate).Connect(callback),
		CollectionService.GetInstanceAddedSignal(TAGS.FishVariantAppearance).Connect(callback),
	];
}

/** The variant's recoloured texture; the normal look without one (warned once: it should have arrived by now). */
function getVariantAppearance(fishType: FishType, variant: FishVariant): SurfaceAppearance | undefined {
	const found = findVariantAppearance(fishType, variant);
	if (found) return found;
	const key = `${fishType}_${variant}`;
	warnOnce(key, `[Client] No "${key}" appearance (Assets.FishVariants, tag FishVariantAppearance).`);
	return undefined;
}

/** Galaxy appearances being animated, with the tint asked for them (hunger, a UFO's aura) and their own phase. */
const galaxyTints = new Map<SurfaceAppearance, { base: Color3; phase: number }>();
let galaxyConnection: RBXScriptConnection | undefined;

function animateGalaxy() {
	const time = os.clock();
	for (const [appearance, tint] of galaxyTints) {
		if (!appearance.IsDescendantOf(game)) {
			galaxyTints.delete(appearance);
			continue;
		}
		const wave = math.sin(((time / GALAXY_PULSE + tint.phase) % 1) * math.pi * 2);
		const pulse = wave > 0 ? new Color3(1, 1, 1).Lerp(GALAXY_VIOLET, wave) : new Color3(1, 1, 1).Lerp(GALAXY_BLUE, -wave);
		appearance.Color = new Color3(tint.base.R * pulse.R, tint.base.G * pulse.G, tint.base.B * pulse.B);
	}
	if (galaxyTints.size() === 0 && galaxyConnection) {
		galaxyConnection.Disconnect();
		galaxyConnection = undefined;
	}
}

function startGalaxyTint(appearance: SurfaceAppearance) {
	galaxyTints.set(appearance, { base: appearance.Color, phase: math.random() });
	if (!galaxyConnection) galaxyConnection = RunService.RenderStepped.Connect(animateGalaxy);
}

/**
 * Tints a fish's appearance (hunger, a UFO's aura: FishRenderController). A Galaxy one keeps its colour pulse on top
 * of the tint asked for (set at once: the pulse already moves every frame); the others take it, tweened over `time`.
 */
export function setFishTint(appearance: SurfaceAppearance, color: Color3, time: number, tween: (time: number) => void) {
	const galaxy = galaxyTints.get(appearance);
	if (galaxy) galaxy.base = color;
	else if (time <= 0) appearance.Color = color;
	else tween(time);
}

/** The Galaxy's stars: a steady twinkle on the body and, now and then, a quick shooting star across it. */
function addGalaxyStars(mesh: BasePart) {
	const size = math.max(mesh.Size.X, mesh.Size.Y, mesh.Size.Z);
	const twinkle = (peak: number) =>
		new NumberSequence([
			new NumberSequenceKeypoint(0, 0),
			new NumberSequenceKeypoint(0.5, peak),
			new NumberSequenceKeypoint(1, 0),
		]);
	const stars = new Instance("ParticleEmitter");
	stars.Name = "GalaxyStars";
	stars.Texture = SPARKLE_TEXTURE;
	stars.Color = GALAXY_STAR_COLOR;
	stars.LightEmission = 1;
	stars.LightInfluence = 0;
	stars.Brightness = 2.5;
	stars.Size = twinkle(math.clamp(size * 0.1, 0.15, 0.5));
	stars.Lifetime = new NumberRange(0.8, 1.6);
	stars.Rate = 14;
	stars.Speed = new NumberRange(0);
	stars.Rotation = new NumberRange(0, 90);
	stars.Shape = Enum.ParticleEmitterShape.Box;
	stars.ShapeStyle = Enum.ParticleEmitterShapeStyle.Surface;
	stars.LockedToPart = true;
	stars.Parent = mesh;
	const shooting = new Instance("ParticleEmitter");
	shooting.Name = "GalaxyShootingStar";
	shooting.Texture = SPARKLE_TEXTURE;
	shooting.Color = GALAXY_STAR_COLOR;
	shooting.LightEmission = 1;
	shooting.LightInfluence = 0;
	shooting.Brightness = 4;
	shooting.Size = new NumberSequence([
		new NumberSequenceKeypoint(0, math.clamp(size * 0.14, 0.2, 0.6)),
		new NumberSequenceKeypoint(1, 0),
	]);
	shooting.Squash = new NumberSequence(-1.2); // stretched along its path: a streak
	shooting.Lifetime = new NumberRange(0.35, 0.5);
	shooting.Rate = 0.4;
	shooting.Speed = new NumberRange(size * 1.2, size * 1.8);
	shooting.SpreadAngle = new Vector2(70, 20);
	shooting.Shape = Enum.ParticleEmitterShape.Box;
	shooting.ShapeStyle = Enum.ParticleEmitterShapeStyle.Surface;
	shooting.LockedToPart = true;
	shooting.Parent = mesh;
}

/** A fresh clone of the species' template, without its template tag. */
export function cloneFishTemplate(fishType: FishType): Model | undefined {
	const template = getFishTemplate(fishType);
	if (!template) return undefined;
	const model = template.Clone();
	CollectionService.RemoveTag(model, TAGS.FishTemplate);
	return model;
}

/**
 * Dresses a freshly cloned model in its variant: the recoloured texture of an anomaly / shiny / galaxy (the galaxy's
 * colour pulsing), the pale translucent body of a ghost and, with `particles`, the twinkles of a shiny or the galaxy's stars (like a sparkling
 * coin's; a ViewportFrame can't show particles, so the UI draws its own).
 */
export function applyVariantLook(model: Model, fishType: FishType, variant: FishVariant, particles = true) {
	if (variant === "Normal") return;
	const recoloured = RECOLOURED_VARIANTS.includes(variant) ? getVariantAppearance(fishType, variant) : undefined;
	for (const descendant of model.GetDescendants()) {
		if (descendant.IsA("SurfaceAppearance")) {
			if (recoloured) {
				const appearance = recoloured.Clone();
				CollectionService.RemoveTag(appearance, TAGS.FishVariantAppearance);
				appearance.Parent = descendant.Parent;
				descendant.Destroy();
				if (variant === "Galaxy") startGalaxyTint(appearance);
			} else if (variant === "Ghost") {
				descendant.Color = descendant.Color.Lerp(GHOST_TINT, GHOST_TINT_AMOUNT);
			}
		} else if (descendant.IsA("BasePart") && descendant !== model.PrimaryPart && variant === "Ghost") {
			descendant.Transparency = GHOST_TRANSPARENCY;
		}
	}
	if (!particles || !FISH_VARIANTS[variant].sparkles) return;
	const mesh = model.FindFirstChild("Mesh");
	if (!mesh?.IsA("BasePart")) return;
	if (variant === "Galaxy") {
		addGalaxyStars(mesh);
		return;
	}
	const size = math.max(mesh.Size.X, mesh.Size.Y, mesh.Size.Z);
	const twinkle = (peak: number) =>
		new NumberSequence([
			new NumberSequenceKeypoint(0, 0),
			new NumberSequenceKeypoint(0.4, peak),
			new NumberSequenceKeypoint(1, 0),
		]);
	const sparkles = new Instance("ParticleEmitter");
	sparkles.Name = "ShinySparkles";
	sparkles.Texture = SPARKLE_TEXTURE;
	sparkles.Color = SPARKLE_COLOR;
	sparkles.LightEmission = 1;
	sparkles.LightInfluence = 0;
	sparkles.Brightness = 2;
	sparkles.Size = twinkle(math.clamp(size * 0.18, 0.3, 0.8));
	sparkles.Lifetime = new NumberRange(0.4, 0.8);
	sparkles.Rate = 16;
	sparkles.Speed = new NumberRange(0.2, 0.8);
	sparkles.SpreadAngle = new Vector2(180, 180);
	sparkles.Rotation = new NumberRange(0, 360);
	sparkles.RotSpeed = new NumberRange(-120, 120);
	sparkles.Shape = Enum.ParticleEmitterShape.Box;
	sparkles.ShapeStyle = Enum.ParticleEmitterShapeStyle.Surface;
	sparkles.Parent = mesh;
	// A periodic star glint on the body
	const glint = new Instance("ParticleEmitter");
	glint.Name = "ShinyGlint";
	glint.Texture = SPARKLE_TEXTURE;
	glint.Color = SPARKLE_COLOR;
	glint.LightEmission = 1;
	glint.LightInfluence = 0;
	glint.Brightness = 3;
	glint.Size = twinkle(math.clamp(size * 0.45, 0.8, 2));
	glint.Lifetime = new NumberRange(0.6);
	glint.Rate = 1.5;
	glint.Speed = new NumberRange(0);
	glint.RotSpeed = new NumberRange(90);
	glint.Shape = Enum.ParticleEmitterShape.Box;
	glint.ShapeStyle = Enum.ParticleEmitterShapeStyle.Surface;
	glint.LockedToPart = true;
	glint.Parent = mesh;
}
