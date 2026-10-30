// Aquarium geometry. The lobby and the aquariums themselves are built in Studio
// (Workspace.Lobby, models tagged "Aquarium"); these numbers describe one tank model
// so the client can compute the focus zone / camera from the model's actual position.

export const AQUARIUM_INNER_SIZE = new Vector3(48, 22, 20);
export const AQUARIUM_BASE_HEIGHT = 2;
export const AQUARIUM_GLASS_THICKNESS = 1;

/** Depth (studs) of the area in front of the glass that triggers the focus view. */
export const FOCUS_ZONE_DEPTH = 9;

/** Local Z of the outer face of the front glass (the front of a tank is its -Z side). */
export const FRONT_GLASS_Z = -(AQUARIUM_INNER_SIZE.Z / 2 + AQUARIUM_GLASS_THICKNESS);

/** Visible front of a tank in Studio (glass, rims and base), framed by the focus camera. */
export const TANK_FRONT_SIZE = new Vector2(52.6, 25);
/** Local Y of the middle of that visible front. */
export const TANK_FRONT_CENTER_Y = 12;
/** Local Z of the outer face of the front rim (slightly in front of the glass). */
export const TANK_FRONT_Z = -12.3;

/**
 * Frame of an aquarium model: origin at the centre of the tank on the floor, LookVector
 * pointing out of the front glass. Read from the model's PrimaryPart (its "Base"), so
 * moving or rotating the model in Studio just works.
 */
export function getAquariumFrame(model: Model): CFrame | undefined {
	const base = model.PrimaryPart;
	if (!base) return undefined;
	return base.CFrame.mul(new CFrame(0, -AQUARIUM_BASE_HEIGHT / 2, 0));
}

/**
 * Whether a world position stands in the focus zone in front of the given aquarium.
 * `margin` widens the zone (the server uses a little tolerance when validating).
 */
export function isInFocusZone(aquariumCFrame: CFrame, position: Vector3, margin = 0): boolean {
	const localPos = aquariumCFrame.PointToObjectSpace(position);
	return (
		math.abs(localPos.X) <= AQUARIUM_INNER_SIZE.X / 2 + margin &&
		localPos.Z <= FRONT_GLASS_Z + margin &&
		localPos.Z >= FRONT_GLASS_Z - FOCUS_ZONE_DEPTH - margin &&
		localPos.Y <= AQUARIUM_BASE_HEIGHT + AQUARIUM_INNER_SIZE.Y + margin
	);
}
