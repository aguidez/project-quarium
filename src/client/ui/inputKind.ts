import { useEffect, useState } from "@rbxts/react";
import { UserInputService } from "@rbxts/services";

/** How the player plays right now: the instructions say "Click", "Tap" or "Press A" to match. */
export type InputKind = "Mouse" | "Touch" | "Gamepad";

function fromInputType(inputType: Enum.UserInputType): InputKind | undefined {
	if (inputType.Name.sub(1, 7) === "Gamepad") return "Gamepad";
	if (inputType === Enum.UserInputType.Touch) return "Touch";
	if (
		inputType === Enum.UserInputType.Keyboard ||
		inputType === Enum.UserInputType.MouseButton1 ||
		inputType === Enum.UserInputType.MouseButton2 ||
		inputType === Enum.UserInputType.MouseMovement ||
		inputType === Enum.UserInputType.MouseWheel
	)
		return "Mouse";
	return undefined;
}

/** The last input used, or the device's main one before any input (a console has no keyboard nor touch screen). */
export function getInputKind(): InputKind {
	const last = fromInputType(UserInputService.GetLastInputType());
	if (last) return last;
	if (UserInputService.TouchEnabled && !UserInputService.KeyboardEnabled) return "Touch";
	if (UserInputService.GamepadEnabled && !UserInputService.KeyboardEnabled) return "Gamepad";
	return "Mouse";
}

/** Called back whenever the kind of input changes (a gamepad picked up, a tap on a touch laptop). */
export function onInputKindChanged(listener: (kind: InputKind) => void): () => void {
	let current = getInputKind();
	const connection = UserInputService.LastInputTypeChanged.Connect(() => {
		const kind = getInputKind();
		if (kind === current) return;
		current = kind;
		listener(kind);
	});
	return () => connection.Disconnect();
}

export function useInputKind(): InputKind {
	const [kind, setKind] = useState(getInputKind);
	useEffect(() => onInputKindChanged(setKind), []);
	return kind;
}

/** The verb of a click on the world for this input: "Click", "Tap" or "Press A". */
export function getPressVerb(kind: InputKind): string {
	return kind === "Touch" ? "Tap" : kind === "Gamepad" ? "Press A" : "Click";
}
