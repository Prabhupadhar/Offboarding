import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { sha256 } from "./sha256";
import { seed } from "./seed";
import { reducer, caseSummary, openFindings } from "./store";
import { band, caseScore, findingScore, recencyMultiplier } from "./risk";
import { verifyChain } from "./audit";
import { buildReceipt } from "./receipt";
import type { Finding } from "./types";

const JOHN = "c-1042";

describe("sha256", () => {
  it("matches Node's implementation", () => {
    for (const s of ["", "abc", "offboarding ✓", "x".repeat(1000)])
      expect(sha256(s)).toBe(createHash("sha256").update(s).digest("hex"));
  });
});

describe("demo scenario", () => {
  const s = seed();
  const john = caseSummary(s, s.cases.find((c) => c.id === JOHN)!);

  it("has 50 people", () => expect(s.employees).toHaveLength(50));
  it("discovers 12 systems for John: 8 verified, 2 manual, 2 active", () => {
    expect(john.accounts).toHaveLength(12);
    expect(john.counts).toEqual({ verified: 8, action: 2, active: 2, unknown: 0 });
  });
  it("finds John's owned resources, AWS role, OAuth grants and token", () => {
    const kinds = john.open.map((f) => f.kind);
    expect(john.open.filter((f) => f.kind === "owned_resource")).toHaveLength(4);
    expect(kinds.filter((k) => k === "oauth_grant")).toHaveLength(2);
    expect(kinds.filter((k) => k === "api_token")).toHaveLength(1);
    expect(kinds.filter((k) => k === "privileged_access")).toHaveLength(1);
  });
  it("rates John's case critical", () => expect(john.band).toBe("critical"));
});

describe("risk engine", () => {
  const base: Finding = { id: "x", caseId: "c", kind: "api_token", title: "", detail: "", impact: 5, exposure: "external", status: "open", fix: "revoke" };
  it("doubles for use after the last day", () => {
    expect(recencyMultiplier("2026-10-11T02:00:00Z", "2026-10-10")).toBe(2);
    expect(recencyMultiplier("2026-10-10T23:00:00Z", "2026-10-10")).toBe(1.25);
    expect(recencyMultiplier("2026-09-01T00:00:00Z", "2026-10-10")).toBe(1);
  });
  it("caps at 10", () => expect(findingScore({ ...base, lastUsed: "2026-10-12T00:00:00Z" }, "2026-10-10")).toBe(10));
  it("does not let many small items add up to critical", () => {
    const small = Array.from({ length: 10 }, (_, i) => ({ ...base, id: `s${i}`, impact: 1 as const, exposure: "contained" as const }));
    expect(band(caseScore(small, "2026-10-10"))).toBe("low");
  });
  it("is clear when nothing is open", () => expect(caseScore([{ ...base, status: "resolved" }], "2026-10-10")).toBe(0));
});

describe("workflow", () => {
  it("cannot close a case with open items", () => {
    const s = seed();
    const after = reducer(s, { type: "close", caseId: JOHN });
    expect(after.cases.find((c) => c.id === JOHN)!.closedAt).toBeUndefined();
  });

  it("resolves everything, closes, and issues a complete receipt", () => {
    let s = seed();
    for (const f of openFindings(s, JOHN)) {
      if (f.id === "f-12") s = reducer(s, { type: "accept", findingId: f.id, reason: "Card deactivated; recovery by post" });
      else s = reducer(s, { type: "resolve", findingId: f.id, method: f.fix === "verify" ? "manual" : "api", transferTo: f.fix === "transfer" ? "Kenji Watanabe" : undefined });
    }
    const summary = caseSummary(s, s.cases.find((c) => c.id === JOHN)!);
    expect(summary.counts.verified).toBe(12);
    expect(summary.band).toBe("clear");

    s = reducer(s, { type: "close", caseId: JOHN });
    const c = s.cases.find((x) => x.id === JOHN)!;
    expect(c.closedBy).toBe("Rahul Mehta");

    const r = buildReceipt(s, JOHN);
    expect(r.outstanding).toBe(0);
    expect(r.exceptions).toBe(1);
    expect(r.systemsChecked).toBe(12);
    expect(r.lines.some((l) => l.outcome === "TRANSFERRED" && l.note?.includes("Kenji"))).toBe(true);
    expect(r.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyChain(s.audit)).toBeNull();
  });

  it("requires a reason for exceptions and overrides", () => {
    const s = seed();
    expect(reducer(s, { type: "accept", findingId: "f-1", reason: "  " })).toBe(s);
    expect(reducer(s, { type: "override", caseId: JOHN, band: "low", reason: "" })).toBe(s);
  });

  it("override changes the band but not once everything is resolved", () => {
    const s = reducer(seed(), { type: "override", caseId: JOHN, band: "medium", reason: "Key is read-only" });
    expect(caseSummary(s, s.cases.find((c) => c.id === JOHN)!).band).toBe("medium");
  });

  it("opens a new case with checks for every account", () => {
    const s0 = seed();
    const tom = s0.employees.find((e) => e.name === "Tom Becker")!;
    const s = reducer(s0, { type: "open", employeeId: tom.id, lastDay: "2026-10-23" });
    const c = s.cases.find((x) => x.employeeId === tom.id)!;
    expect(c.id).toBe("c-1045");
    const sum = caseSummary(s, c);
    expect(sum.open.length).toBe(sum.accounts.length);
    expect(sum.counts.action).toBeGreaterThan(0);
  });
});

describe("audit chain", () => {
  it("detects tampering", () => {
    const s = seed();
    expect(verifyChain(s.audit)).toBeNull();
    const tampered = s.audit.map((e, i) => (i === 3 ? { ...e, actor: "Someone else" } : e));
    expect(verifyChain(tampered)).toBe(4);
  });
});
