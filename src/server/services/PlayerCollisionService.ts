import { Janitor } from "@rbxts/janitor";
import { PhysicsService, Players } from "@rbxts/services";
import { Lifecycle } from "shared/framework";

/** Collision group of every player's character: it doesn't collide with itself (players walk through each other). */
export const PLAYERS_COLLISION_GROUP = "Players";

/**
 * Players walk through each other: every part of a character (accessories and tools included, as they appear) joins
 * PLAYERS_COLLISION_GROUP, which doesn't collide with itself. The world (Default group) still collides with them.
 */
class PlayerCollisionServiceSingleton implements Lifecycle {
	private janitors = new Map<Player, Janitor>();

	public onInit() {
		PhysicsService.RegisterCollisionGroup(PLAYERS_COLLISION_GROUP);
		PhysicsService.CollisionGroupSetCollidable(PLAYERS_COLLISION_GROUP, PLAYERS_COLLISION_GROUP, false);
		Players.PlayerAdded.Connect((player) => this.watch(player));
		Players.PlayerRemoving.Connect((player) => {
			this.janitors.get(player)?.Destroy();
			this.janitors.delete(player);
		});
		for (const player of Players.GetPlayers()) this.watch(player);
	}

	public onStart() {
		print("[Server] PlayerCollisionService started.");
	}

	private watch(player: Player) {
		if (this.janitors.has(player)) return;
		const janitor = new Janitor();
		this.janitors.set(player, janitor);
		const characterJanitor = new Janitor();
		janitor.Add(characterJanitor, "Destroy");
		const onCharacter = (character: Model) => {
			characterJanitor.Cleanup();
			for (const part of character.GetDescendants()) if (part.IsA("BasePart")) part.CollisionGroup = PLAYERS_COLLISION_GROUP;
			characterJanitor.Add(
				character.DescendantAdded.Connect((part) => {
					if (part.IsA("BasePart")) part.CollisionGroup = PLAYERS_COLLISION_GROUP;
				}),
			);
		};
		janitor.Add(player.CharacterAdded.Connect(onCharacter));
		if (player.Character) onCharacter(player.Character);
	}
}

export const PlayerCollisionService = new PlayerCollisionServiceSingleton();
