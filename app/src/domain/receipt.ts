import { sha256 } from "./sha256";
import type { State } from "./types";

export interface ReceiptLine {
  item: string;
  system: string;
  outcome: "REVOKED" | "VERIFIED" | "TRANSFERRED" | "RETURNED" | "EXCEPTION";
  method: "API re-check" | "Manual attestation" | "Accepted exception" | "Asset check-in";
  by: string;
  at: string;
  note?: string;
}

export interface Receipt {
  number: string;
  organization: string;
  employee: { name: string; email: string; title: string; department: string; type: string };
  lastDay: string;
  openedAt: string;
  closedAt?: string;
  closedBy?: string;
  systemsChecked: number;
  lines: ReceiptLine[];
  assets: { label: string; serial: string; status: string }[];
  exceptions: number;
  outstanding: number;
  auditEvents: number;
  /** SHA-256 of everything above, so a copy can be checked against the stored original. */
  digest: string;
}

export function buildReceipt(s: State, caseId: string): Receipt {
  const c = s.cases.find((x) => x.id === caseId)!;
  const e = s.employees.find((x) => x.id === c.employeeId)!;
  const fs = s.findings.filter((f) => f.caseId === c.id);
  const accts = s.accounts.filter((a) => a.employeeId === e.id);
  const appName = (id?: string) => s.apps.find((a) => a.id === id)?.name ?? "Assets";

  const lines: ReceiptLine[] = [];
  // Accounts verified before or outside a finding (e.g. Google suspended on the last day).
  for (const a of accts) {
    const covered = fs.some((f) => f.accountId === a.id);
    if (covered || a.status !== "verified") continue;
    const app = s.apps.find((x) => x.id === a.appId)!;
    const ev = [...s.audit].reverse().find((x) => x.target === `${e.name} · ${app.name}` && x.action.startsWith("access."));
    lines.push({
      item: `${app.name} account`, system: app.name, outcome: app.kind === "api" ? "REVOKED" : "VERIFIED",
      method: app.kind === "api" ? "API re-check" : "Manual attestation",
      by: ev?.actor ?? "—", at: ev?.at ?? c.lastDay,
    });
  }
  for (const f of fs) {
    if (f.status === "open" || !f.resolution) continue;
    const r = f.resolution;
    lines.push({
      item: f.evidenceLabel ?? f.title,
      system: appName(f.appId),
      outcome: f.status === "accepted" ? "EXCEPTION" : f.fix === "transfer" ? "TRANSFERRED" : f.fix === "return" ? "RETURNED" : r.method === "api" ? "REVOKED" : "VERIFIED",
      method: r.method === "exception" ? "Accepted exception" : f.fix === "return" ? "Asset check-in" : r.method === "api" ? "API re-check" : "Manual attestation",
      by: r.by, at: r.at,
      note: [r.transferTo && `New owner: ${r.transferTo}`, r.note].filter(Boolean).join(" · ") || undefined,
    });
  }
  lines.sort((a, b) => a.at.localeCompare(b.at));

  const body = {
    number: `OB-${c.id.slice(2)}`,
    organization: s.org.name,
    employee: { name: e.name, email: e.email, title: e.title, department: e.department, type: e.type },
    lastDay: c.lastDay,
    openedAt: c.openedAt,
    closedAt: c.closedAt,
    closedBy: c.closedBy,
    systemsChecked: new Set(accts.map((a) => a.appId)).size,
    lines,
    assets: s.assets.filter((a) => a.employeeId === e.id).map(({ label, serial, status }) => ({ label, serial, status })),
    exceptions: fs.filter((f) => f.status === "accepted").length,
    outstanding: fs.filter((f) => f.status === "open").length,
    auditEvents: s.audit.filter((x) => x.target.startsWith(e.name)).length,
  };
  return { ...body, digest: sha256(JSON.stringify(body)) };
}
