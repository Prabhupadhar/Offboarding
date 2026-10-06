import type { ReactNode } from "react";
import type { Application, RiskBand, VerificationStatus } from "../domain/types";

export const STATUS_LABEL: Record<VerificationStatus, string> = {
  verified: "Verified",
  active: "Still active",
  action: "Action required",
  unknown: "Unknown",
};

export function StatusPill({ status }: { status: VerificationStatus }) {
  return <span className={`pill ${status}`}>{STATUS_LABEL[status]}</span>;
}

export function BandPill({ band, score }: { band: RiskBand | "clear"; score?: number }) {
  return (
    <span className={`pill ${band}`}>
      {band === "clear" ? "No open risk" : `${band} risk`}
      {score !== undefined && band !== "clear" && <span className="num"> · {score.toFixed(1)}</span>}
    </span>
  );
}

export function AppMark({ app }: { app?: Application }) {
  return <span className="mark" aria-hidden="true">{app?.mark ?? "◻"}</span>;
}

export function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return <span className="avatar" aria-hidden="true">{initials}</span>;
}

export function Bar({ ok, bad, warn, unk }: { ok: number; bad: number; warn: number; unk?: number }) {
  const total = ok + bad + warn + (unk ?? 0) || 1;
  const w = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="bar" role="img" aria-label={`${ok} verified, ${bad} still active, ${warn} need action`}>
      <i className="ok" style={{ width: w(ok) }} />
      <i className="bad" style={{ width: w(bad) }} />
      <i className="warn" style={{ width: w(warn) }} />
      {unk ? <i className="unk" style={{ width: w(unk) }} /> : null}
    </div>
  );
}

export function Page({ title, sub, actions, children }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          {sub && <p>{sub}</p>}
        </div>
        {actions && <div className="row">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const fmtDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const when = (iso?: string) => (iso ? fmt.format(new Date(iso)) : "—");
export const day = (iso?: string) => (iso ? fmtDay.format(new Date(iso)) : "—");
export const daysBetween = (a: string, b: string) => Math.floor((Date.parse(b) - Date.parse(a)) / 86_400_000);

export async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
