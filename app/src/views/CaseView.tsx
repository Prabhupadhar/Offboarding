import { useState } from "react";
import { useStore, go } from "../state";
import { caseScore, explain, findingScore } from "../domain/risk";
import { caseSummary } from "../domain/store";
import type { Finding, FindingKind, RiskBand } from "../domain/types";
import { AppMark, Avatar, BandPill, Bar, Page, StatusPill, day, daysBetween, when } from "../components/ui";

const GROUPS: { title: string; blurb: string; kinds: FindingKind[] }[] = [
  { title: "Access that still works", blurb: "Accounts and admin rights the leaver can still use.", kinds: ["active_account", "privileged_access", "unknown_access"] },
  { title: "Keys, tokens and connected apps", blurb: "Credentials that keep working after the person’s account is suspended.", kinds: ["api_token", "oauth_grant"] },
  { title: "Things they own", blurb: "Hand these to someone else before the account is deleted.", kinds: ["owned_resource"] },
  { title: "Needs a person to check", blurb: "No API for these. Someone checks by hand and records what they saw.", kinds: ["manual_check"] },
  { title: "Company equipment", blurb: "Laptops, badges and hardware keys.", kinds: ["asset"] },
];

export function CaseView({ caseId }: { caseId: string }) {
  const { state, dispatch, toast } = useStore();
  const [tab, setTab] = useState<"items" | "map" | "activity">("items");
  const c = state.cases.find((x) => x.id === caseId);
  if (!c) return <Page title="Case not found"><a href="#/">Back to overview</a></Page>;

  const s = caseSummary(state, c);
  const score = caseScore(s.findings, c.lastDay);
  const today = state.now.slice(0, 10);
  const daysSince = daysBetween(c.lastDay, today);
  const activeApps = s.accounts.filter((a) => a.status === "active").map((a) => state.apps.find((x) => x.id === a.appId)!.name);
  const events = state.audit.filter((e) => e.target.startsWith(s.employee.name)).reverse();
  const done = s.open.length === 0;

  return (
    <Page
      title={<span className="row" style={{ gap: 12 }}><Avatar name={s.employee.name} />{s.employee.name}</span>}
      sub={`${s.employee.title} · ${s.employee.department}${s.employee.type === "contractor" ? " · Contractor" : ""} · ${s.employee.email}`}
      actions={c.closedAt ? <a className="btn primary" href={`#/cases/${c.id}/receipt`}>View receipt</a> : null}
    >
      <div className="card case-hero">
        <div className="who">
          <div className="row" style={{ gap: "6px 22px" }}>
            <div><div className="label">Case</div><div className="mono">{c.id.toUpperCase()}</div></div>
            <div><div className="label">Last day</div><div className="num">{day(c.lastDay)} {daysSince > 0 && <span className="muted">· {daysSince} days ago</span>}{daysSince < 0 && <span className="muted">· in {-daysSince} days</span>}</div></div>
            <div><div className="label">Opened by</div><div>{c.openedBy}</div></div>
            <div><div className="label">Owner</div><div>{c.owner}</div></div>
          </div>
          <BandPill band={s.band} score={score} />
        </div>

        {c.closedAt ? (
          <div className="verdict done">
            <strong>Offboarding complete</strong>
            <span className="reason">Closed by {c.closedBy} on {when(c.closedAt)}. Receipt OB-{c.id.slice(2)} is on file.</span>
          </div>
        ) : done ? (
          <div className="verdict done">
            <strong>Ready to close</strong>
            <span className="reason">Every item is verified, transferred, returned or recorded as an exception.</span>
          </div>
        ) : (
          <div className="verdict">
            <strong>Not complete · {s.open.length} open item{s.open.length === 1 ? "" : "s"}</strong>
            <span className="reason">
              {activeApps.length > 0
                ? `${activeApps.join(" and ")} access still works${daysSince > 0 ? ` ${daysSince} days after the last day` : ""}.`
                : "No account is still active, but owned resources, credentials or checks remain."}
            </span>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Bar ok={s.counts.verified} bad={s.counts.active} warn={s.counts.action} unk={s.counts.unknown} />
          <div className="legend">
            <span><i style={{ background: "var(--ok)" }} />{s.counts.verified} verified</span>
            <span><i style={{ background: "var(--bad)" }} />{s.counts.active} still active</span>
            <span><i style={{ background: "var(--warn)" }} />{s.counts.action} action required</span>
            <span><i style={{ background: "var(--unk)" }} />{s.counts.unknown} unknown</span>
            <span className="muted">· {s.accounts.length} systems discovered</span>
          </div>
        </div>
        {!c.closedAt && <RiskOverride caseId={c.id} />}
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "items"} className={tab === "items" ? "on" : ""} onClick={() => setTab("items")}>Items<span className="count">{s.open.length} open</span></button>
        <button role="tab" aria-selected={tab === "map"} className={tab === "map" ? "on" : ""} onClick={() => setTab("map")}>Access map<span className="count">{s.accounts.length}</span></button>
        <button role="tab" aria-selected={tab === "activity"} className={tab === "activity" ? "on" : ""} onClick={() => setTab("activity")}>Activity<span className="count">{events.length}</span></button>
      </div>

      {tab === "items" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {GROUPS.map((g) => {
            const items = s.findings
              .filter((f) => g.kinds.includes(f.kind))
              .sort((a, b) => (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1) || findingScore(b, c.lastDay) - findingScore(a, c.lastDay));
            if (items.length === 0) return null;
            const openN = items.filter((f) => f.status === "open").length;
            return (
              <section className="group" key={g.title}>
                <div className="group-head"><h2>{g.title}</h2><span className="muted num">{openN} open</span><p style={{ flexBasis: "100%" }}>{g.blurb}</p></div>
                {items.map((f) => <Item key={f.id} f={f} lastDay={c.lastDay} closed={!!c.closedAt} />)}
              </section>
            );
          })}
          <section className="group">
            <div className="group-head"><h2>Equipment on record</h2></div>
            <div className="card table-wrap">
              <table><tbody>
                {state.assets.filter((a) => a.employeeId === s.employee.id).map((a) => (
                  <tr key={a.id}><td>{a.label}</td><td className="mono muted">{a.serial}</td><td style={{ textAlign: "right" }}><span className={`pill ${a.status === "returned" ? "verified" : "action"}`}>{a.status === "returned" ? "Returned" : "Outstanding"}</span></td></tr>
                ))}
              </tbody></table>
            </div>
          </section>
        </div>
      )}

      {tab === "map" && <AccessMap employeeId={s.employee.id} />}

      {tab === "activity" && (
        <div className="card card-pad feed">
          {events.map((e) => (
            <div className="ev" key={e.seq}>
              <time>{when(e.at)}</time>
              <div><b>{e.actor}</b> <span className="mono muted">{e.action}</span><div>{e.target}</div>{e.detail && <div className="muted">{e.detail}</div>}</div>
            </div>
          ))}
        </div>
      )}

      {!c.closedAt && (
        <div className="closebar">
          <span>{done ? "All items are settled. Closing records who closed it and issues a receipt." : `Closing is blocked until ${s.open.length} item${s.open.length === 1 ? " is" : "s are"} resolved or recorded as exceptions.`}</span>
          <button className="btn primary" disabled={!done} onClick={() => { dispatch({ type: "close", caseId: c.id }); toast("Case closed. Receipt issued."); go(`/cases/${c.id}/receipt`); }}>
            Close case and issue receipt
          </button>
        </div>
      )}
    </Page>
  );
}

function Item({ f, lastDay, closed }: { f: Finding; lastDay: string; closed: boolean }) {
  const { state, dispatch, toast } = useStore();
  const [mode, setMode] = useState<null | "verify" | "transfer" | "exception">(null);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<string | undefined>();
  const [owner, setOwner] = useState("");
  const app = state.apps.find((a) => a.id === f.appId);
  const score = findingScore(f, lastDay);
  const open = f.status === "open";
  const sevBand: RiskBand | "clear" = score >= 8 ? "critical" : score >= 5 ? "high" : score >= 2.5 ? "medium" : "low";
  const candidates = state.employees.filter((e) => e.status === "active" && (e.department === "Engineering" || e.department === "Operations" || e.department === "Leadership"));

  const revoke = () => {
    dispatch({ type: "resolve", findingId: f.id, method: "api" });
    toast(`Revoked in ${app?.name}. Re-checked: access is gone.`);
  };
  const reset = () => { setMode(null); setNote(""); setFile(undefined); setOwner(""); };

  return (
    <div className={`card item ${open ? "" : "done"}`}>
      <AppMark app={app} />
      <div className="body">
        <div className="title">
          {f.title}
          {open ? <span className={`pill ${sevBand}`}>{sevBand}</span> : <span className={`pill ${f.status}`}>{f.status === "accepted" ? "Exception" : "Resolved"}</span>}
        </div>
        {f.detail && <p className="detail">{f.detail}</p>}
        {open && <div className="why">{explain(f, lastDay).map((r) => <span className="chip" key={r}>{r}</span>)}</div>}
        {!open && f.resolution && (
          <p className="resolution">
            {f.resolution.method === "api" ? "Revoked and re-checked via API" : f.resolution.method === "manual" ? "Verified by hand" : "Exception accepted"} · {f.resolution.by} · {when(f.resolution.at)}
            {f.resolution.transferTo && <> · New owner: {f.resolution.transferTo}</>}
            {f.resolution.note && <> · “{f.resolution.note}”</>}
          </p>
        )}
      </div>
      <div className="side">
        {open && <span className="score num" title="Risk score out of 10">{score.toFixed(1)}</span>}
        {open && !closed && mode === null && (
          <div className="row end">
            {f.fix === "revoke" && app?.canRevoke && <button className="btn primary sm" onClick={revoke}>{f.kind === "oauth_grant" ? "Revoke grant" : f.kind === "api_token" ? "Disable key" : `Remove from ${app.name}`}</button>}
            {f.fix === "revoke" && !app?.canRevoke && <button className="btn primary sm" onClick={() => setMode("verify")}>Mark as verified</button>}
            {f.fix === "transfer" && <button className="btn primary sm" onClick={() => setMode("transfer")}>Transfer ownership</button>}
            {f.fix === "verify" && <button className="btn primary sm" onClick={() => setMode("verify")}>Mark as verified</button>}
            {f.fix === "return" && <button className="btn primary sm" onClick={() => { dispatch({ type: "resolve", findingId: f.id, method: "manual", note: "Checked in by IT" }); toast("Marked as returned"); }}>Mark returned</button>}
            <button className="btn ghost sm" onClick={() => setMode("exception")}>Accept risk</button>
          </div>
        )}
        {!open && !closed && <button className="btn ghost sm" onClick={() => dispatch({ type: "reopen", findingId: f.id })}>Reopen</button>}
      </div>

      {mode === "verify" && (
        <form className="panel" onSubmit={(e) => { e.preventDefault(); dispatch({ type: "resolve", findingId: f.id, method: "manual", note: note.trim() || undefined, evidence: file }); toast("Recorded as verified"); reset(); }}>
          {app?.manualSteps && <div className="steps"><b>How to check {app.name}:</b> {app.manualSteps}</div>}
          <label className="field"><span>What did you see? (optional)</span><textarea id={`note-${f.id}`} className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. User shows as Inactive in Setup → Users" /></label>
          <label className="field"><span>Screenshot (optional)</span><input id={`file-${f.id}`} type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0]?.name)} /></label>
          <p className="muted" style={{ fontSize: "0.8rem" }}>This is recorded as a manual attestation by {state.me.name}, with the time. Manual checks are labelled as such on the receipt.</p>
          <div className="row end"><button type="button" className="btn sm" onClick={reset}>Cancel</button><button className="btn primary sm" type="submit">Record as verified</button></div>
        </form>
      )}
      {mode === "transfer" && (
        <form className="panel" onSubmit={(e) => { e.preventDefault(); if (!owner) return; dispatch({ type: "resolve", findingId: f.id, method: app?.kind === "api" && f.kind !== "oauth_grant" ? "api" : "manual", transferTo: owner, note: note.trim() || undefined }); toast(`Transferred to ${owner}`); reset(); }}>
          <label className="field"><span>New owner</span>
            <select id={`owner-${f.id}`} className="input" value={owner} onChange={(e) => setOwner(e.target.value)} required>
              <option value="">Choose a person…</option>
              <option value="ops@acmetech.io (shared)">ops@acmetech.io (shared)</option>
              {candidates.map((e) => <option key={e.id} value={e.name}>{e.name} · {e.title}</option>)}
            </select>
          </label>
          <label className="field"><span>Note (optional)</span><input id={`tnote-${f.id}`} className="input" value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <div className="row end"><button type="button" className="btn sm" onClick={reset}>Cancel</button><button className="btn primary sm" type="submit" disabled={!owner}>Transfer</button></div>
        </form>
      )}
      {mode === "exception" && (
        <form className="panel" onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; dispatch({ type: "accept", findingId: f.id, reason: note }); toast("Exception recorded"); reset(); }}>
          <label className="field"><span>Why is it acceptable to leave this as it is?</span><textarea id={`reason-${f.id}`} className="input" value={note} onChange={(e) => setNote(e.target.value)} required placeholder="e.g. Contractor keeps read access until invoice dispute is settled; review on 1 Nov" /></label>
          <p className="muted" style={{ fontSize: "0.8rem" }}>Exceptions don’t block closing, but they are listed on the receipt with your name and reason.</p>
          <div className="row end"><button type="button" className="btn sm" onClick={reset}>Cancel</button><button className="btn danger sm" type="submit" disabled={!note.trim()}>Record exception</button></div>
        </form>
      )}
    </div>
  );
}

export function AccessMap({ employeeId }: { employeeId: string }) {
  const { state } = useStore();
  const accts = state.accounts.filter((a) => a.employeeId === employeeId);
  const leaving = state.employees.find((e) => e.id === employeeId)?.status !== "active";
  const order = { active: 0, action: 1, unknown: 2, verified: 3 } as const;
  const sorted = [...accts].sort((a, b) => order[a.status] - order[b.status]);
  const via = { api: "Connected API", "sso-logs": "Google sign-in logs", inventory: "App inventory" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="footprint">
        {sorted.map((a) => {
          const app = state.apps.find((x) => x.id === a.appId)!;
          return (
            <div key={a.id} className={`tile ${leaving ? a.status : ""}`}>
              <div className="top"><AppMark app={app} />{app.name}</div>
              {leaving ? <StatusPill status={a.status} /> : <span className="pill neutral">In use</span>}
            </div>
          );
        })}
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>System</th><th>Identity</th><th>Matched by</th><th>Role</th><th>Found via</th><th>Last active</th><th>Status</th></tr></thead>
          <tbody>
            {sorted.map((a) => {
              const app = state.apps.find((x) => x.id === a.appId)!;
              return (
                <tr key={a.id}>
                  <td><div className="cell-app"><AppMark app={app} />{app.name}</div></td>
                  <td className="mono" style={{ maxWidth: 240, overflowWrap: "anywhere" }}>{a.externalId}</td>
                  <td>{a.matchedBy}{a.matchConfidence < 1 && <span className="muted num"> · {Math.round(a.matchConfidence * 100)}%</span>}</td>
                  <td>{a.role} {a.privileged && <span className="chip priv">privileged</span>} {a.bypassesSso && <span className="chip">no SSO</span>}</td>
                  <td className="muted">{via[a.discoveredVia]}</td>
                  <td className="num muted">{when(a.lastActive)}</td>
                  <td>{leaving ? <StatusPill status={a.status} /> : <span className="pill neutral">In use</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="callout">Identities are matched by work email first, then SSO subject, then username or commit email (shown with a confidence). Anything below 90% asks for a person to confirm the match before it counts.</p>
    </div>
  );
}

function RiskOverride({ caseId }: { caseId: string }) {
  const { state, dispatch, toast } = useStore();
  const c = state.cases.find((x) => x.id === caseId)!;
  const [open, setOpen] = useState(false);
  const [band, setBand] = useState<RiskBand>("medium");
  const [reason, setReason] = useState("");
  if (c.riskOverride)
    return (
      <p className="callout">
        Risk manually set to <b>{c.riskOverride.band}</b> by {c.riskOverride.by} ({when(c.riskOverride.at)}): “{c.riskOverride.reason}”.{" "}
        <button className="btn ghost sm" onClick={() => dispatch({ type: "clearOverride", caseId })}>Use calculated risk</button>
      </p>
    );
  if (!open) return <div><button className="btn ghost sm" onClick={() => setOpen(true)}>Override risk level…</button></div>;
  return (
    <form className="panel" onSubmit={(e) => { e.preventDefault(); dispatch({ type: "override", caseId, band, reason }); toast("Risk override recorded in the audit log"); setOpen(false); }}>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <label className="field" style={{ width: 160 }}><span>Set risk to</span>
          <select id="override-band" className="input" value={band} onChange={(e) => setBand(e.target.value as RiskBand)}>
            {(["low", "medium", "high", "critical"] as const).map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label className="field" style={{ flex: 1, minWidth: 200 }}><span>Reason (required, logged)</span><input id="override-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} required /></label>
      </div>
      <div className="row end"><button type="button" className="btn sm" onClick={() => setOpen(false)}>Cancel</button><button className="btn primary sm" type="submit" disabled={!reason.trim()}>Save override</button></div>
    </form>
  );
}
