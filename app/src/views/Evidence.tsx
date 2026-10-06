import { useState } from "react";
import { useStore } from "../state";
import { verifyChain } from "../domain/audit";
import { Page, when } from "../components/ui";

export function Evidence() {
  const { state } = useStore();
  const [check, setCheck] = useState<null | { at: string; broken: number | null }>(null);
  const [q, setQ] = useState("");
  const closed = state.cases.filter((c) => c.closedAt);
  const head = state.audit[state.audit.length - 1];
  const events = [...state.audit].reverse().filter((e) => !q || `${e.actor} ${e.action} ${e.target} ${e.detail ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <Page title="Evidence & audit" sub="Receipts for every closed offboarding, and the log behind them.">
      <section className="section">
        <h2>Receipts</h2>
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Receipt</th><th>Person</th><th>Last day</th><th>Closed</th><th /></tr></thead>
            <tbody>
              {closed.map((c) => {
                const e = state.employees.find((x) => x.id === c.employeeId)!;
                return (
                  <tr key={c.id}>
                    <td className="mono">OB-{c.id.slice(2)}</td>
                    <td>{e.name}</td>
                    <td className="num">{c.lastDay}</td>
                    <td className="num muted">{when(c.closedAt)} · {c.closedBy}</td>
                    <td style={{ textAlign: "right" }}><a href={`#/cases/${c.id}/receipt`}>Open</a></td>
                  </tr>
                );
              })}
              {closed.length === 0 && <tr><td colSpan={5} className="empty">No closed cases yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Audit log</h2>
          <div className="row">
            <input id="audit-search" className="input" style={{ width: 220 }} placeholder="Filter events" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn sm" onClick={() => setCheck({ at: new Date().toISOString(), broken: verifyChain(state.audit) })}>Verify chain</button>
          </div>
        </div>
        <p className="callout">
          Each event stores the SHA-256 of the one before it, so changing or deleting any past event breaks every hash after it.
          {" "}{state.audit.length} events · head <span className="mono">{head?.hash.slice(0, 16)}…</span>
          {check && (check.broken === null
            ? <> · <b style={{ color: "var(--ok)" }}>Chain intact</b> (checked {when(check.at)})</>
            : <> · <b style={{ color: "var(--bad)" }}>Broken at event {check.broken}</b></>)}
        </p>
        <div className="card table-wrap">
          <table>
            <thead><tr><th>#</th><th>Time (UTC)</th><th>Actor</th><th>Action</th><th>Target</th><th>Hash</th></tr></thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.seq}>
                  <td className="num muted">{e.seq}</td>
                  <td className="num" style={{ whiteSpace: "nowrap" }}>{when(e.at)}</td>
                  <td>{e.actor}</td>
                  <td className="mono">{e.action}</td>
                  <td style={{ minWidth: 220 }}>{e.target}{e.detail && <div className="muted" style={{ fontSize: "0.8rem" }}>{e.detail}</div>}</td>
                  <td className="mono muted">{e.hash.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Page>
  );
}
