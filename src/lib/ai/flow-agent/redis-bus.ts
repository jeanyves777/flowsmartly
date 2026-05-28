import Redis from "ioredis";

/**
 * Flow-AI Redis pub/sub bus — the cross-process backbone for the
 * multi-device / multi-worker story.
 *
 * Why: the dev box runs a single Next.js process, so the in-process
 * EventEmitter in job-state.ts is enough. In prod, FlowSmartly runs
 * under PM2 with multiple workers — a background task's progress event
 * emitted on worker A must reach a chat SSE stream pinned to worker B,
 * and a plan-confirmation POST that lands on worker B must wake an agent
 * loop blocked on worker A. EventEmitter can't cross processes; Redis
 * pub/sub can.
 *
 * Design:
 *   - TWO connections (ioredis requirement): one publisher, one
 *     subscriber. A connection in subscriber mode can't issue other
 *     commands, so they must be separate.
 *   - The subscriber does ONE `psubscribe("flow-ai:*")` and routes every
 *     message to a local EventEmitter keyed by channel. job-state.ts
 *     listens on that local emitter — so its existing per-task /
 *     per-plan subscription logic is unchanged; it's just now fed by
 *     Redis (cross-process) instead of direct local emits.
 *   - GRACEFUL DEGRADATION: if REDIS_URL is unset or the connection
 *     fails, `getRedisBus()` returns null and job-state.ts falls back to
 *     the pure in-process EventEmitter path. Single-worker correctness is
 *     never broken by a missing/broken Redis.
 *
 * Channels:
 *   - flow-ai:task:{taskId}   — one background task's progress
 *   - flow-ai:task:any        — global task feed (notification fanout)
 *   - flow-ai:confirm         — plan confirmations (planId in payload)
 */

import { EventEmitter } from "events";

export interface RedisBus {
  /** Publish a JSON-serializable payload to a channel. Fire-and-forget. */
  publish: (channel: string, payload: unknown) => void;
  /** Local emitter fed by the Redis subscriber. Listen by channel name. */
  emitter: EventEmitter;
}

let bus: RedisBus | null | undefined; // undefined = not yet initialized

const CHANNEL_PREFIX = "flow-ai:";
const PATTERN = "flow-ai:*";

/**
 * Lazy-init the Redis bus. Returns null when Redis isn't configured or
 * the connection failed — callers MUST handle null by falling back to
 * their in-process path.
 */
export function getRedisBus(): RedisBus | null {
  if (bus !== undefined) return bus;

  const url = process.env.REDIS_URL;
  if (!url) {
    bus = null;
    return null;
  }

  try {
    // Shared options: don't let a flaky Redis hang the app — bounded
    // retries, then we degrade to in-process.
    const opts = {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      retryStrategy: (times: number) => (times > 5 ? null : Math.min(times * 200, 1000)),
      lazyConnect: false,
    };

    const publisher = new Redis(url, opts);
    const subscriber = new Redis(url, opts);
    const emitter = new EventEmitter();
    emitter.setMaxListeners(500);

    publisher.on("error", (e) => console.error("[flow-ai redis pub] error:", e.message));
    subscriber.on("error", (e) => console.error("[flow-ai redis sub] error:", e.message));

    // One pattern subscription routes everything to the local emitter.
    subscriber.psubscribe(PATTERN).catch((e) => {
      console.error("[flow-ai redis] psubscribe failed:", e);
    });
    subscriber.on("pmessage", (_pattern, channel, message) => {
      let payload: unknown = null;
      try {
        payload = JSON.parse(message);
      } catch {
        payload = message;
      }
      emitter.emit(channel, payload);
    });

    bus = {
      publish: (channel, payload) => {
        try {
          publisher.publish(channel, JSON.stringify(payload));
        } catch (e) {
          console.error("[flow-ai redis] publish failed:", e);
        }
      },
      emitter,
    };
    console.log("[flow-ai redis] pub/sub bus initialized");
    return bus;
  } catch (e) {
    console.error("[flow-ai redis] init failed — falling back to in-process bus:", e);
    bus = null;
    return null;
  }
}

export function channel(name: string): string {
  return name.startsWith(CHANNEL_PREFIX) ? name : `${CHANNEL_PREFIX}${name}`;
}

export function isRedisBusEnabled(): boolean {
  return getRedisBus() !== null;
}
