import { appendEvent } from "./audit";
import { caseBand } from "./risk";
import { seed } from "./seed";
import type { Finding, OffboardingCase, RiskBand, State, VerificationMethod } from "./types";

export type Action =
  | { type: "resolve"; findingId: string; method: VerificationMethod; note?: string; transferTo?: string; evidence?: string }
  | { type: "accept"; findingId: string; reason: string }
  | { type: "reopen"; findingId: string }
  | { type: "override"; caseId: string; band: RiskBand; reason: string }
  | { type: "clearOverride"; caseId: string }
  | { type: "close"; caseId: string }
  | { type: "open"; employeeId: string; lastDay: string }
  | { type: "reset" };

// The demo clock advances a minute per action so the audit trail reads naturally.
const tick = (s: State): State => ({ ...s, now: new Date(Date.parse(s.now) + 60_000).toISOString() });

const who = (s: State, f: Finding) => {
  const c = s.cases.find((x) => x.id === f.caseId)!;
  const e = s.employees.find((x) => x.id === c.employeeId)!;
  const app = s.apps.find((a) => a.id === f.appId);
  return `${e.name} · ${app?.name ?? "Assets"}`;
};

export function openFindings(s: State, caseId: string) {
  return s.findings.filter((f) => f.caseId === caseId && f.status === "open");
}

export function reducer(state: State, action: Action): State {
  if (action.type === "reset") return seed();
  let s = tick(state);
  const me = s.me.name;

  switch (action.type) {
    case "resolve": {
      const f = s.findings.find((x) => x.id === action.findingId);
      if (!f || f.status !== "open") return state;
      const app = s.apps.find((a) => a.id === f.appId);
      const resolution = {
        method: action.method,
        by: action.method === "api" ? `${app?.name ?? "System"} API` : me,
        at: s.now,
        note: [action.note, action.evidence && `Attachment: ${action.evidence}`].filter(Boolean).join(" · ") || undefined,
        transferTo: action.transferTo,
      };
      s = {
        ...s,
        findings: s.findings.map((x) => (x.id === f.id ? { ...x, status: "resolved", resolution } : x)),
        accounts: f.accountId
          ? s.accounts.map((a) => (a.id === f.accountId ? { ...a, status: "verified" } : a))
          : s.accounts,
        assets: f.assetId ? s.assets.map((a) => (a.id === f.assetId ? { ...a, status: "returned" } : a)) : s.assets,
      };
      const verb =
        f.fix === "transfer" ? "ownership.transferred" : f.fix === "return" ? "asset.returned"
          : action.method === "api" ? "access.revoked" : "access.attested";
      const detail = [
        f.title,
        action.transferTo && `New owner: ${action.transferTo}`,
        action.method === "api" && "Re-read after change confirms access is gone",
        resolution.note,
      ].filter(Boolean).join(" · ");
      return appendEvent(s, { at: s.now, actor: me, action: verb, target: who(s, f), detail });
    }
    case "accept": {
      const f = s.findings.find((x) => x.id === action.findingId);
      if (!f || f.status !== "open" || !action.reason.trim()) return state;
      s = {
        ...s,
        findings: s.findings.map((x) =>
          x.id === f.id ? { ...x, status: "accepted", resolution: { method: "exception", by: me, at: s.now, note: action.reason } } : x),
      };
      return appendEvent(s, { at: s.now, actor: me, action: "exception.accepted", target: who(s, f), detail: `${f.title} · Reason: ${action.reason}` });
    }
    case "reopen": {
      const f = s.findings.find((x) => x.id === action.findingId);
      const c = f && s.cases.find((x) => x.id === f.caseId);
      if (!f || f.status === "open" || c?.closedAt) return state;
      s = {
        ...s,
        findings: s.findings.map((x) => (x.id === f.id ? { ...x, status: "open", resolution: undefined } : x)),
        accounts: f.accountId ? s.accounts.map((a) => (a.id === f.accountId ? { ...a, status: f.kind === "manual_check" ? "action" : "active" } : a)) : s.accounts,
        assets: f.assetId ? s.assets.map((a) => (a.id === f.assetId ? { ...a, status: "assigned" } : a)) : s.assets,
      };
      return appendEvent(s, { at: s.now, actor: me, action: "finding.reopened", target: who(s, f), detail: f.title });
    }
    case "override": {
      if (!action.reason.trim()) return state;
      s = updateCase(s, action.caseId, (c) => ({ ...c, riskOverride: { band: action.band, reason: action.reason, by: me, at: s.now } }));
      return appendEvent(s, { at: s.now, actor: me, action: "risk.overridden", target: caseLabel(s, action.caseId), detail: `Set to ${action.band} · ${action.reason}` });
    }
    case "clearOverride": {
      s = updateCase(s, action.caseId, (c) => ({ ...c, riskOverride: undefined }));
      return appendEvent(s, { at: s.now, actor: me, action: "risk.override_cleared", target: caseLabel(s, action.caseId) });
    }
    case "close": {
      const c = s.cases.find((x) => x.id === action.caseId);
      if (!c || c.closedAt || openFindings(s, c.id).length > 0) return state;
      s = updateCase(s, c.id, (x) => ({ ...x, closedAt: s.now, closedBy: me }));
      s = { ...s, employees: s.employees.map((e) => (e.id === c.employeeId ? { ...e, status: "offboarded" } : e)) };
      const exceptions = s.findings.filter((f) => f.caseId === c.id && f.status === "accepted").length;
      return appendEvent(s, { at: s.now, actor: me, action: "case.closed", target: caseLabel(s, c.id), detail: `Receipt OB-${c.id.slice(2)} issued · ${exceptions} exception(s)` });
    }
    case "open": {
      const e = s.employees.find((x) => x.id === action.employeeId);
      if (!e || s.cases.some((c) => c.employeeId === e.id && !c.closedAt)) return state;
      const id = nextCaseId(s);
      const accts = s.accounts.filter((a) => a.employeeId === e.id);
      const newFindings: Finding[] = accts.map((a, i) => {
        const app = s.apps.find((x) => x.id === a.appId)!;
        return {
          id: `f-${id}-${i}`, caseId: id, appId: a.appId, accountId: a.id,
          kind: app.kind === "api" ? "active_account" : "manual_check",
          fix: app.kind === "api" ? "revoke" : "verify",
          title: app.kind === "api" ? `Remove ${app.name} access` : `Confirm ${app.name} access is removed`,
          detail: app.kind === "api" ? `${a.role} · matched by ${a.matchedBy}` : app.manualSteps ?? "",
          impact: a.privileged ? 4 : a.appId === "aws" || a.appId === "github" || a.appId === "1password" ? 4 : 2,
          exposure: a.bypassesSso ? "external" : "normal",
          status: "open",
        };
      });
      for (const a of s.assets.filter((x) => x.employeeId === e.id && x.status === "assigned"))
        newFindings.push({ id: `f-${id}-${a.id}`, caseId: id, assetId: a.id, kind: "asset", fix: "return", title: `Recover ${a.label}`, detail: `Serial ${a.serial}`, impact: 1, exposure: "contained", status: "open" });
      s = {
        ...s,
        cases: [...s.cases, { id, employeeId: e.id, lastDay: action.lastDay, openedAt: s.now, openedBy: me, owner: me }],
        findings: [...s.findings, ...newFindings],
        employees: s.employees.map((x) => (x.id === e.id ? { ...x, status: "leaving" } : x)),
        accounts: s.accounts.map((a) => {
          if (a.employeeId !== e.id) return a;
          const app = s.apps.find((x) => x.id === a.appId)!;
          return { ...a, status: app.kind === "api" ? "active" : "action" };
        }),
      };
      s = appendEvent(s, { at: s.now, actor: me, action: "case.opened", target: `${e.name} (${id})`, detail: `Last day ${action.lastDay}` });
      return appendEvent(s, { at: s.now, actor: "Discovery", action: "discovery.completed", target: `${e.name} (${id})`, detail: `${accts.length} accounts found` });
    }
  }
}

export function nextCaseId(s: State): string {
  return `c-${Math.max(...s.cases.map((c) => Number(c.id.slice(2)))) + 1}`;
}

function updateCase(s: State, id: string, fn: (c: OffboardingCase) => OffboardingCase): State {
  return { ...s, cases: s.cases.map((c) => (c.id === id ? fn(c) : c)) };
}

export function caseLabel(s: State, caseId: string) {
  const c = s.cases.find((x) => x.id === caseId)!;
  return `${s.employees.find((e) => e.id === c.employeeId)!.name} (${c.id})`;
}

export function caseSummary(s: State, c: OffboardingCase) {
  const fs = s.findings.filter((f) => f.caseId === c.id);
  const accts = s.accounts.filter((a) => a.employeeId === c.employeeId);
  return {
    employee: s.employees.find((e) => e.id === c.employeeId)!,
    findings: fs,
    open: fs.filter((f) => f.status === "open"),
    accounts: accts,
    counts: {
      verified: accts.filter((a) => a.status === "verified").length,
      active: accts.filter((a) => a.status === "active").length,
      action: accts.filter((a) => a.status === "action").length,
      unknown: accts.filter((a) => a.status === "unknown").length,
    },
    band: caseBand(c, s.findings),
  };
}
