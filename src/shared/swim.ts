import { TweenService } from "@rbxts/services";

/**
 * One step of a fish's swimming. The server decides every step (wander, chase food...) and
 * sends it to the clients watching the tank; both sides compute the pose at any moment with
 * getSwimPose, on the shared clock (Workspace.GetServerTimeNow), so no position is streamed.
 */
export interface SwimSegment {
	from: CFrame; // pose at `start`
	target: Vector3; // where it swims to
	start: number; // Workspace.GetServerTimeNow()
	turnTime: number; // first turns on the spot to face the target...
	moveTime: number; // ...then glides there
	linear: boolean; // chase steps keep a constant speed (wandering eases in and out)
}

/** A segment that holds `pose` (spawn, or a fish waiting). */
export function holdSegment(pose: CFrame, start: number): SwimSegment {
	return { from: pose, target: pose.Position, start, turnTime: 0, moveTime: 0, linear: true };
}

export function getSwimEnd(segment: SwimSegment): number {
	return segment.start + segment.turnTime + segment.moveTime;
}

/** Orientation once turned toward the target (unchanged if it's right there). */
function getFacing(segment: SwimSegment): CFrame {
	const origin = segment.from.Position;
	if (segment.target.sub(origin).Magnitude < 0.01) return segment.from.Rotation;
	return CFrame.lookAt(origin, segment.target).Rotation;
}

function ease(alpha: number): number {
	return TweenService.GetValue(alpha, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut);
}

/** Pose of a fish following `segment` at `time` (clamped to the segment's start and end). */
export function getSwimPose(segment: SwimSegment, time: number): CFrame {
	const elapsed = time - segment.start;
	const origin = segment.from.Position;
	if (segment.turnTime > 0 && elapsed < segment.turnTime) {
		const alpha = ease(math.max(elapsed, 0) / segment.turnTime);
		return segment.from.Rotation.Lerp(getFacing(segment), alpha).add(origin);
	}
	const facing = getFacing(segment);
	if (segment.moveTime <= 0) return facing.add(segment.target);
	const progress = math.clamp((elapsed - segment.turnTime) / segment.moveTime, 0, 1);
	const alpha = segment.linear ? progress : ease(progress);
	return facing.add(origin.Lerp(segment.target, alpha));
}
