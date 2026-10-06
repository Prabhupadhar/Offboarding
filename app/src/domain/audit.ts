import { sha256 } from "./sha256";
import type { AuditEvent, State } from "./types";

export const GENESIS = "0".repeat(64);

type NewEvent = Pick<AuditEvent, "at" | "actor" | "action" | "target" | "detail">;

/** What gets hashed: every field except the hash itself, in a fixed order. */
export function canonical(e: Omit<AuditEvent, "hash">): string {
  return JSON.stringify([e.seq, e.at, e.actor, e.action, e.target, e.detail ?? null, e.prevHash]);
}

/** Append-only, hash-chained log: editing or deleting any event breaks every later hash. */
export function appendEvent(state: State, e: NewEvent): State {
  const prev = state.audit[state.audit.length - 1];
  const base = { ...e, seq: (prev?.seq ?? 0) + 1, prevHash: prev?.hash ?? GENESIS };
  const event: AuditEvent = { ...base, hash: sha256(canonical(base)) };
  return { ...state, audit: [...state.audit, event] };
}

/** Returns the seq of the first broken event, or null if the chain is intact. */
export function verifyChain(events: AuditEvent[]): number | null {
  let prevHash = GENESIS;
  for (const e of events) {
    if (e.prevHash !== prevHash) return e.seq;
    const { hash, ...rest } = e;
    if (sha256(canonical(rest)) !== hash) return e.seq;
    prevHash = hash;
  }
  return null;
}
