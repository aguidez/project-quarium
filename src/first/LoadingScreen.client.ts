// Runs from ReplicatedFirst, before the rest of the game has replicated: it imports nothing (every
// import goes through ReplicatedStorage, which isn't there yet) and builds its UI from plain instances.
const Players = game.GetService("Players");
const ReplicatedFirst = game.GetService("ReplicatedFirst");
const ReplicatedStorage = game.GetService("ReplicatedStorage");
const ContentProvider = game.GetService("ContentProvider");
const TweenService = game.GetService("TweenService");
const RunService = game.GetService("RunService");
const Workspace = game.GetService("Workspace");

/** design/ui/loading/LoadingBannerClean.png: the banner without its baked bar (FigCraft: LoadingScreen). */
const BACKGROUND = "rbxassetid://119725316551413";
/** design/ui/loading/LoadingTail.png: the fish tail on the left end of the bar (FigCraft: TailSprite). */
const TAIL = "rbxassetid://137183236921957";
const BACKGROUND_COLOR = Color3.fromHex("#7EC8E8"); // the banner's sky, while the artwork downloads
/** The bar is designed on the 1024 × 434 banner and scaled with the screen's height. */
const DESIGN_HEIGHT = 434;
const TRACK_WIDTH = 200;
const TRACK_HEIGHT = 28;
const TRACK_INSET = 4;
const TAIL_SIZE = new Vector2(32, 40);
const TAIL_OVERLAP = 6; // the tail tucks under the track's rounded end
const BOTTOM_MARGIN = 10;
/** Set locally by UiController once the first PlayerData snapshot arrived (the save is loaded). */
const DATA_LOADED_ATTRIBUTE = "DataLoaded";

const MIN_TIME = 2.5; // seconds: the screen never just flashes by
const MAX_TIME = 45; // seconds: never trap a player behind it (a failed data load kicks them anyway)
const FADE_TIME = 0.6;
const ARTWORK_FADE_TIME = 0.4;
const ARTWORK_WAIT = 8; // seconds the screen may stay up for its artwork alone (first download)
const ARTWORK_MIN_VISIBLE = 1.5; // seconds the artwork stays on screen once shown
const SMOOTHING = 6; // how fast the bar catches up with the real progress (per second)
const TAIL_WIGGLE = 10; // degrees: the tail swishes while loading

const player = Players.LocalPlayer;
const startedAt = os.clock();

// ---------------------------------------------------------------------
// UI (FigCraft: LoadingScreen / LoadingBar)
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

function gradient(top: string, bottom: string, parent: Instance) {
	make(
		"UIGradient",
		{ Color: new ColorSequence(Color3.fromHex(top), Color3.fromHex(bottom)), Rotation: 90 },
		parent,
	);
}

function corner(radius: UDim, parent: Instance) {
	make("UICorner", { CornerRadius: radius }, parent);
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
const background = make(
	"ImageLabel",
	{
		Name: "Background",
		Size: UDim2.fromScale(1, 1),
		BackgroundTransparency: 1,
		Image: BACKGROUND,
		ImageTransparency: 1, // fades in once downloaded
		ScaleType: Enum.ScaleType.Crop,
	},
	root,
);

// "LOADING... 64%" above a fish-shaped bar: tail on the left, rounded track
const bar = make(
	"Frame",
	{
		Name: "LoadingBar",
		AnchorPoint: new Vector2(0.5, 1),
		Position: new UDim2(0.5, 0, 1, 0),
		Size: UDim2.fromOffset(0, 0),
		AutomaticSize: Enum.AutomaticSize.XY,
		BackgroundTransparency: 1,
	},
	root,
);
const barScale = make("UIScale", {}, bar);
make(
	"UIListLayout",
	{ HorizontalAlignment: Enum.HorizontalAlignment.Center, Padding: new UDim(0, 2), SortOrder: Enum.SortOrder.LayoutOrder },
	bar,
);
make("UIPadding", { PaddingBottom: new UDim(0, BOTTOM_MARGIN) }, bar);

const label = make(
	"TextLabel",
	{
		Name: "Label",
		LayoutOrder: 1,
		Size: UDim2.fromOffset(TRACK_WIDTH, 24),
		BackgroundTransparency: 1,
		Font: Enum.Font.GothamBlack,
		Text: "LOADING... 0%",
		TextSize: 20,
		TextColor3: Color3.fromHex("#DFF6FF"),
	},
	bar,
);
make("UIStroke", { Color: Color3.fromHex("#0F3B73"), Thickness: 3 }, label);

const row = make(
	"Frame",
	{
		Name: "Row",
		LayoutOrder: 2,
		Size: UDim2.fromOffset(TAIL_SIZE.X + TRACK_WIDTH - TAIL_OVERLAP, TAIL_SIZE.Y),
		BackgroundTransparency: 1,
	},
	bar,
);
const tail = make(
	"ImageLabel",
	{
		Name: "Tail",
		AnchorPoint: new Vector2(0, 0.5),
		Position: UDim2.fromScale(0, 0.5),
		Size: UDim2.fromOffset(TAIL_SIZE.X, TAIL_SIZE.Y),
		BackgroundTransparency: 1,
		Image: TAIL,
	},
	row,
);
const track = make(
	"Frame",
	{
		Name: "Track",
		AnchorPoint: new Vector2(1, 0.5),
		Position: UDim2.fromScale(1, 0.5),
		Size: UDim2.fromOffset(TRACK_WIDTH, TRACK_HEIGHT),
		BackgroundColor3: Color3.fromHex("#FFFFFF"),
		ClipsDescendants: true,
		ZIndex: 2,
	},
	row,
);
gradient("#1B4A86", "#0F2E5C", track);
corner(new UDim(0.5, 0), track);
make("UIStroke", { Color: Color3.fromHex("#8FD8FF"), Thickness: 3, ApplyStrokeMode: Enum.ApplyStrokeMode.Border }, track);

const fillHeight = TRACK_HEIGHT - TRACK_INSET * 2;
const fill = make(
	"Frame",
	{
		Name: "Fill",
		Position: UDim2.fromOffset(TRACK_INSET, TRACK_INSET),
		Size: UDim2.fromOffset(fillHeight, fillHeight),
		BackgroundColor3: Color3.fromHex("#FFFFFF"),
		ZIndex: 2,
	},
	track,
);
gradient("#8FE4FF", "#2C8EE6", fill);
corner(new UDim(0.5, 0), fill);
const shine = make(
	"Frame",
	{
		Name: "Shine",
		Position: new UDim2(0, 6, 0, 2),
		Size: new UDim2(1, -12, 0, 5),
		BackgroundColor3: Color3.fromHex("#FFFFFF"),
		BackgroundTransparency: 0.6,
		ZIndex: 2,
	},
	fill,
);
corner(new UDim(0.5, 0), shine);

gui.Parent = player.WaitForChild("PlayerGui");
ReplicatedFirst.RemoveDefaultLoadingScreen();

// Shown right away on the plain sky colour; the artwork fades in once downloaded
let artworkShownAt: number | undefined;
task.spawn(() => {
	ContentProvider.PreloadAsync([background, tail]);
	TweenService.Create(background, new TweenInfo(ARTWORK_FADE_TIME), { ImageTransparency: 0 }).Play();
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
let shown = 0; // what the bar displays, catching up smoothly

const heartbeat = RunService.RenderStepped.Connect((dt) => {
	const viewport = Workspace.CurrentCamera?.ViewportSize;
	barScale.Scale = viewport ? math.clamp(viewport.Y / DESIGN_HEIGHT, 0.8, 3.2) : 1;

	shown += (target - shown) * math.min(dt * SMOOTHING, 1);
	const room = TRACK_WIDTH - TRACK_INSET * 2 - fillHeight;
	fill.Size = UDim2.fromOffset(fillHeight + room * shown, fillHeight);
	label.Text = `LOADING... ${math.floor(shown * 100 + 0.5)}%`;
	tail.Rotation = math.sin((os.clock() - startedAt) * 5) * TAIL_WIGGLE;
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

const fade = TweenService.Create(root, new TweenInfo(FADE_TIME, Enum.EasingStyle.Quad), { GroupTransparency: 1 });
fade.Play();
fade.Completed.Wait();
heartbeat.Disconnect();
gui.Destroy();
