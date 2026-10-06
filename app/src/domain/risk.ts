import type { Finding, OffboardingCase, RiskBand } from "./types";

/**
 * Risk model
 * ----------
 * Each open finding gets a score on 0–10:
 *
 *   score = impact (1–5) × exposure × recency, capped at 10
 *
 * impact    What an attacker (or the ex-employee) could do with it.
 *           5 = admin / production cloud / long-lived credential
 *           4 = active account in a system holding customer or source data
 *           3 = OAuth grant with write scopes, or access we could not verify
 *           2 = owned resource with no new owner (continuity risk), manual check pending
 *           1 = low-sensitivity leftovers (e.g. unreturned access badge after building access was disabled)
 * exposure  Can it be used without the identity provider?
 *           contained ×0.6  only usable inside a system already locked
 *           normal    ×1.0  usable through normal sign-in
 *           external  ×1.5  works from the internet without SSO (keys, PATs, local passwords)
 * recency   Evidence that it is live.
 *           used after the last day      ×2.0
 *           used in the 7 days before it ×1.25
 *           otherwise / unknown          ×1.0
 *
 * Case score = highest finding + 15% of the rest, capped at 10. One critical
 * item should dominate; ten trivial items should not add up to a critical case.
 *
 * Bands: ≥ 8 critical · ≥ 5 high · ≥ 2.5 medium · > 0 low · 0 clear.
 */

export const EXPOSURE = { contained: 0.6, normal: 1, external: 1.5 } as const;

const DAY = 86_400_000;

export function recencyMultiplier(lastUsed: string | undefined, lastDay: string): number {
  if (!lastUsed) return 1;
  const used = Date.parse(lastUsed);
  const end = Date.parse(lastDay) + DAY; // the last day counts as before departure
  if (used >= end) return 2;
  if (end - used <= 7 * DAY) return 1.25;
  return 1;
}

export function findingScore(f: Finding, lastDay: string): number {
  const raw = f.impact * EXPOSURE[f.exposure] * recencyMultiplier(f.lastUsed, lastDay);
  return Math.min(10, Math.round(raw * 10) / 10);
}

export function caseScore(findings: Finding[], lastDay: string): number {
  const scores = findings
    .filter((f) => f.status === "open")
    .map((f) => findingScore(f, lastDay))
    .sort((a, b) => b - a);
  if (scores.length === 0) return 0;
  const [top, ...rest] = scores;
  const total = top + 0.15 * rest.reduce((s, x) => s + x, 0);
  return Math.min(10, Math.round(total * 10) / 10);
}

export function band(score: number): RiskBand | "clear" {
  if (score >= 8) return "critical";
  if (score >= 5) return "high";
  if (score >= 2.5) return "medium";
  if (score > 0) return "low";
  return "clear";
}

/** Effective band: an admin override wins, but only while findings remain open. */
export function caseBand(c: OffboardingCase, findings: Finding[]): RiskBand | "clear" {
  const own = findings.filter((f) => f.caseId === c.id);
  const computed = band(caseScore(own, c.lastDay));
  if (computed === "clear") return "clear";
  return c.riskOverride?.band ?? computed;
}

/** Plain-language reasons shown next to a score, so nobody has to trust a number. */
export function explain(f: Finding, lastDay: string): string[] {
  const out = [`Impact ${f.impact}/5`];
  if (f.exposure === "external") out.push("works without SSO");
  if (f.exposure === "contained") out.push("contained to a locked system");
  const r = recencyMultiplier(f.lastUsed, lastDay);
  if (r === 2) out.push("used after last day");
  else if (r === 1.25) out.push("used in final week");
  return out;
}
