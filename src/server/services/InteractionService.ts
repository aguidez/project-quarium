import { Players } from "@rbxts/services";
import { t } from "@rbxts/t";
import { Lifecycle } from "shared/framework";
import { getRemoteEvent, InteractionKind } from "shared/network";

const MAX_INTERACTIONS_PER_SECOND = 10;

type InteractionHandler = (player: Player, payload: unknown) => void;

interface TokenBucket {
	tokens: number;
	updatedAt: number;
}

/**
 * Single entry point for every in-world interaction (food, coins, future ones).
 * Each player has a token bucket of MAX_INTERACTIONS_PER_SECOND tokens refilled
 * continuously, so no interaction kind can exceed the limit, alone or combined.
 */
class InteractionServiceSingleton implements Lifecycle {
	private interactRemote = getRemoteEvent("Interact");
	private handlers = new Map<string, InteractionHandler>();
	private buckets = new Map<Player, TokenBucket>();

	public onInit() {
		this.interactRemote.OnServerEvent.Connect((player, kind, payload) => {
			if (!t.string(kind)) return;
			// Consume before dispatching so spamming unknown kinds is limited too
			if (!this.tryConsume(player)) return;
			this.handlers.get(kind)?.(player, payload);
		});

		Players.PlayerRemoving.Connect((player) => this.buckets.delete(player));
	}

	public onStart() {
		print("[Server] InteractionService started.");
	}

	/** Registers the handler of an interaction kind; the payload is validated with `check` first. */
	public register<T>(kind: InteractionKind, check: t.check<T>, handler: (player: Player, payload: T) => void) {
		this.handlers.set(kind, (player, payload) => {
			if (check(payload)) handler(player, payload);
		});
	}

	private tryConsume(player: Player): boolean {
		const now = os.clock();
		let bucket = this.buckets.get(player);
		if (!bucket) {
			bucket = { tokens: MAX_INTERACTIONS_PER_SECOND, updatedAt: now };
			this.buckets.set(player, bucket);
		}

		const refill = (now - bucket.updatedAt) * MAX_INTERACTIONS_PER_SECOND;
		bucket.tokens = math.min(MAX_INTERACTIONS_PER_SECOND, bucket.tokens + refill);
		bucket.updatedAt = now;

		if (bucket.tokens < 1) return false;
		bucket.tokens -= 1;
		return true;
	}
}

export const InteractionService = new InteractionServiceSingleton();
