// Runs from ReplicatedFirst, before the rest of the game has replicated: it imports nothing (every
// import goes through ReplicatedStorage, which isn't there yet) and builds its UI from plain instances.
const Players = game.GetService("Players");
const ReplicatedFirst = game.GetService("ReplicatedFirst");
const ReplicatedStorage = game.GetService("ReplicatedStorage");
const ContentProvider = game.GetService("ContentProvider");
const TweenService = game.GetService("TweenService");
const RunService = game.GetService("RunService");

// The owner's picture (design/ui/loading/LoadingArt.png), prepared by tools/loading-art.js
/** LoadingBackground.png: the picture without its baked bar. */
const BACKGROUND = "rbxassetid://116115984041240";
/** LoadingLogo.png: the "Project: Quarium" logo cut out, top half full, bottom half with empty letters. */
const LOGO = "rbxassetid://85036446211506";
const BACKGROUND_COLOR = Color3.fromHex("#1E7FD0"); // the picture's water, while it downloads
/** Size of the source picture: LOGO_RECT is measured on it. */
const ART_SIZE = new Vector2(1672, 941);
/** Where the logo sits on the picture (source pixels); also the size of each half of the logo sheet. */
const LOGO_RECT = { x: 450, y: 117, w: 812, h: 298 };

/** The water inside the logo is drawn in vertical slices, each with its own level: a moving wave. */
const SLICES = 40;
const WAVE_HEIGHT = 0.03; // of the logo's height
const WAVES = 1.6; // across the logo
const WAVE_SPEED = 2.6;
/** Texture pixels each slice spills over its neighbours: hides the filtering seams between slices. */
const SLICE_OVERLAP = 2;

/** Set locally by UiController once the first PlayerData snapshot arrived (the save is loaded). */
const DATA_LOADED_ATTRIBUTE = "DataLoaded";

const MIN_TIME = 2.5; // seconds: the screen never just flashes by
const MAX_TIME = 45; // seconds: never trap a player behind it (a failed data load kicks them anyway)
const FULL_HOLD = 0.5; // seconds the full logo stays before the fade
const FADE_TIME = 0.6;
const ARTWORK_FADE_TIME = 0.4;
const ARTWORK_WAIT = 8; // seconds the screen may stay up for its artwork alone (first download)
const ARTWORK_MIN_VISIBLE = 1.5; // seconds the artwork stays on screen once shown
const SMOOTHING = 4; // how fast the water catches up with the real progress (per second)

const player = Players.LocalPlayer;
const startedAt = os.clock();

// Phones and tablets play in landscape only (either side, following the sensor): the UI is laid out for a wide
// screen. StarterGui.ScreenOrientation (default.project.json) already asks for it on join; set here too, as early
// as possible, in case the place's StarterGui says otherwise.
(player.WaitForChild("PlayerGui") as PlayerGui).ScreenOrientation = Enum.ScreenOrientation.LandscapeSensor;

// ---------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------

function make<T extends keyof CreatableInstances>(
	className: T,
	props: Partial<WritableInstanceProperties<CreatableInstances[T]>>,
	parent?: Instance,
): CreatableInstances[T] {
	const instance = new Instance(className);
	for (const [key, value] of pairs(props as Record<string, unknown>)) {
		(instance as unknown as Record<string, unknown>)[key] = value;
	}
	if (parent) instance.Parent = parent;
	return instance;
}

const gui = make("ScreenGui", {
	Name: "LoadingScreen",
	IgnoreGuiInset: true,
	ResetOnSpawn: false,
	DisplayOrder: 1000,
	ZIndexBehavior: Enum.ZIndexBehavior.Sibling,
});
// Fades as one piece
const root = make("CanvasGroup", { Name: "Root", Size: UDim2.fromScale(1, 1), BackgroundColor3: BACKGROUND_COLOR }, gui);
const artwork = make("Frame", { Name: "Artwork", Size: UDim2.fromScale(1, 1), BackgroundTransparency: 1 }, root);
/** The artwork fades in once downloaded (every image follows it). */
let artworkTransparency = 1;
const background = make(
	"ImageLabel",
	{
		Name: "Background",
		Size: UDim2.fromScale(1, 1),
		BackgroundTransparency: 1,
		Image: BACKGROUND,
		ImageTransparency: 1,
		ScaleType: Enum.ScaleType.Crop,
	},
	artwork,
);

// The logo sheet, laid exactly over the logo painted in the background (placed by layoutLogo)
const logo = make("Frame", { Name: "Logo", BackgroundTransparency: 1, ZIndex: 2 }, artwork);
const empty = make(
	"ImageLabel",
	{
		Name: "Empty",
		Size: UDim2.fromScale(1, 1),
		BackgroundTransparency: 1,
		Image: LOGO,
		ImageTransparency: 1,
		ImageRectOffset: new Vector2(0, LOGO_RECT.h),
		ImageRectSize: new Vector2(LOGO_RECT.w, LOGO_RECT.h),
	},
	logo,
);

// Each slice shows the full logo below its own water level: a crop of the sheet's top half
interface Slice {
	image: ImageLabel;
	x: number;
	width: number;
}
const slices: Slice[] = [];
for (let i = 0; i < SLICES; i++) {
	const x = math.max(math.floor((i * LOGO_RECT.w) / SLICES) - SLICE_OVERLAP, 0);
	const width = math.min(math.floor(((i + 1) * LOGO_RECT.w) / SLICES) + SLICE_OVERLAP, LOGO_RECT.w) - x;
	const image = make(
		"ImageLabel",
		{ Name: "Water", BackgroundTransparency: 1, Image: LOGO, Visible: false, ZIndex: 2 },
		logo,
	);
	slices.push({ image, x, width });
}

// Once the water is over the whole logo, one image replaces the slices (no seam at all)
const full = make(
	"ImageLabel",
	{
		Name: "Full",
		Size: UDim2.fromScale(1, 1),
		BackgroundTransparency: 1,
		Image: LOGO,
		ImageRectSize: new Vector2(LOGO_RECT.w, LOGO_RECT.h),
		Visible: false,
		ZIndex: 3,
	},
	logo,
);

/** Water below `cut` (0 = top of the logo, 1 = bottom) in one slice. */
function setLevel(slice: Slice, cut: number) {
	const top = math.clamp(cut, 0, 1) * LOGO_RECT.h;
	const height = LOGO_RECT.h - top;
	slice.image.Visible = height > 0.5;
	if (!slice.image.Visible) return;
	slice.image.ImageTransparency = artworkTransparency;
	slice.image.ImageRectOffset = new Vector2(slice.x, top);
	slice.image.ImageRectSize = new Vector2(slice.width, height);
	slice.image.Position = UDim2.fromScale(slice.x / LOGO_RECT.w, top / LOGO_RECT.h);
	slice.image.Size = UDim2.fromScale(slice.width / LOGO_RECT.w, height / LOGO_RECT.h);
}

/** Follows the background's Crop scaling: the picture fills the screen, centred, its overflow cut off. */
let laidOutFor: Vector2 | undefined;
function layoutLogo() {
	const screen = root.AbsoluteSize;
	if (laidOutFor === screen || screen.X <= 0) return;
	laidOutFor = screen;
	const scale = math.max(screen.X / ART_SIZE.X, screen.Y / ART_SIZE.Y);
	const origin = screen.sub(ART_SIZE.mul(scale)).div(2);
	logo.Position = UDim2.fromOffset(origin.X + LOGO_RECT.x * scale, origin.Y + LOGO_RECT.y * scale);
	logo.Size = UDim2.fromOffset(LOGO_RECT.w * scale, LOGO_RECT.h * scale);
}

gui.Parent = player.WaitForChild("PlayerGui");
ReplicatedFirst.RemoveDefaultLoadingScreen();

// Shown right away on the plain water colour; the artwork fades in once downloaded
let artworkShownAt: number | undefined;
task.spawn(() => {
	ContentProvider.PreloadAsync([background, empty]);
	artworkShownAt = os.clock();
});

/** The players get to see the artwork: wait for it (up to ARTWORK_WAIT), then keep it a moment. */
function artworkSeen(): boolean {
	if (artworkShownAt === undefined) return os.clock() - startedAt > ARTWORK_WAIT;
	return os.clock() - artworkShownAt > ARTWORK_MIN_VISIBLE;
}

// ---------------------------------------------------------------------
// Progress: the game's own content, the shared assets, then the player's save
// ---------------------------------------------------------------------

let target = 0; // real progress (0..1)
let shown = 0; // what the logo displays, catching up smoothly

const heartbeat = RunService.RenderStepped.Connect((dt) => {
	layoutLogo();
	if (artworkShownAt !== undefined && artworkTransparency > 0) {
		artworkTransparency = math.max(1 - (os.clock() - artworkShownAt) / ARTWORK_FADE_TIME, 0);
		background.ImageTransparency = artworkTransparency;
		empty.ImageTransparency = artworkTransparency;
	}
	shown += (target - shown) * math.min(dt * SMOOTHING, 1);
	// From just below the logo (empty) to just above it (full), the wave included
	const level = 1 + WAVE_HEIGHT - shown * (1 + WAVE_HEIGHT * 3);
	const t = os.clock() - startedAt;
	full.Visible = level + WAVE_HEIGHT <= 0;
	full.ImageTransparency = artworkTransparency;
	for (let i = 0; i < SLICES; i++) {
		const wave = math.sin((i / SLICES) * WAVES * math.pi * 2 - t * WAVE_SPEED) * WAVE_HEIGHT;
		setLevel(slices[i], level + wave);
	}
});

function timedOut(): boolean {
	return os.clock() - startedAt > MAX_TIME;
}

/** Eases `target` toward `goal` while `waiting()` holds (a step that can't report its own progress). */
function creep(goal: number, waiting: () => boolean) {
	while (waiting() && !timedOut()) {
		target += (goal - target) * 0.04;
		task.wait(0.05);
	}
	target = math.max(target, goal);
}

// 1. The place's content (map, scripts, UI)
creep(0.45, () => !game.IsLoaded());

// 2. Shared assets the clients clone: the fish models and variant textures of the species on this server (the
// server replicates only those, see server/fishAssets): real progress, item by item
const assets = ReplicatedStorage.WaitForChild("Assets", 10);
const items = assets
	? assets.GetDescendants().filter((d) => d.IsA("Model") || (d.IsA("SurfaceAppearance") && d.Parent?.IsA("Folder") === true))
	: [];
for (let i = 0; i < items.size() && !timedOut(); i++) {
	ContentProvider.PreloadAsync([items[i]]);
	target = math.max(target, 0.45 + (0.35 * (i + 1)) / items.size());
}
target = math.max(target, 0.8);

// 3. The player's save (ProfileStore can take a moment)
creep(0.97, () => player.GetAttribute(DATA_LOADED_ATTRIBUTE) !== true);

target = 1;
while (shown < 0.995 || os.clock() - startedAt < MIN_TIME || !artworkSeen()) task.wait();
task.wait(FULL_HOLD);

const fade = TweenService.Create(root, new TweenInfo(FADE_TIME, Enum.EasingStyle.Quad), { GroupTransparency: 1 });
fade.Play();
fade.Completed.Wait();
heartbeat.Disconnect();
gui.Destroy();
