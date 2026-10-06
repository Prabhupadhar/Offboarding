import { useStore, go } from "../state";
import { caseScore } from "../domain/risk";
import { caseSummary } from "../domain/store";
import { AppMark, BandPill, Bar, Page, day, daysBetween, when } from "../components/ui";

export function Dashboard({ focusCases = false }: { focusCases?: boolean }) {
  const { state, dispatch, toast } = useStore();
  const open = state.cases.filter((c) => !c.closedAt);
  const closed = state.cases.filter((c) => c.closedAt);
  const openFindings = state.findings.filter((f) => f.status === "open" && open.some((c) => c.id === f.caseId));
  const today = state.now.slice(0, 10);
  const liveAfterLastDay = open.filter((c) => {
    if (c.lastDay >= today) return false;
    return state.accounts.some((a) => a.employeeId === c.employeeId && a.status === "active");
  });
  const critical = open.filter((c) => caseSummary(state, c).band === "critical").length;

  // Which systems hold the most open items
  const bySystem = new Map<string, number>();
  for (const f of openFindings) if (f.appId) bySystem.set(f.appId, (bySystem.get(f.appId) ?? 0) + 1);
  const systems = [...bySystem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxSys = systems[0]?.[1] ?? 1;

  const sorted = [...open].sort((a, b) => caseScore(state.findings.filter((f) => f.caseId === b.id), b.lastDay) - caseScore(state.findings.filter((f) => f.caseId === a.id), a.lastDay));

  return (
    <Page
      title={focusCases ? "Offboarding" : "Overview"}
      sub={focusCases ? "Every leaver, and what still stands between them and a closed case." : `${state.org.name} · ${state.employees.length} people · ${state.apps.length} systems tracked`}
      actions={<a className="btn" href="#/people">Start offboarding</a>}
    >
      {!focusCases && (
        <div className="demo-bar">
          <span><b>Demo workspace.</b> John Smith left on 10 Oct. His case shows why “HR marked him terminated” isn’t the same as “he’s gone”.</span>
          <a href="#/cases/c-1042">Open John’s case →</a>
          <button className="btn ghost sm" onClick={() => { dispatch({ type: "reset" }); toast("Demo data reset"); }}>Reset demo</button>
        </div>
      )}

      <div className="kpis">
        <div className="card kpi"><span className="label">Being offboarded</span><span className="v">{open.length}</span><span className="s">{closed.length} closed this quarter</span></div>
        <div className={`card kpi ${openFindings.length ? "alert" : ""}`}><span className="label">Open risks</span><span className="v">{openFindings.length}</span><span className="s">{critical} case{critical === 1 ? "" : "s"} at critical</span></div>
        <div className={`card kpi ${liveAfterLastDay.length ? "alert" : ""}`}><span className="label">Live access after last day</span><span className="v">{liveAfterLastDay.length}</span><span className="s">{liveAfterLastDay.map((c) => state.employees.find((e) => e.id === c.employeeId)!.name.split(" ")[0]).join(", ") || "Nobody"}</span></div>
        <div className="card kpi"><span className="label">Receipts issued</span><span className="v">{closed.length}</span><span className="s">Each one hash-stamped</span></div>
      </div>

      <div className="grid-2">
        <section className="section">
          <div className="section-head"><h2>Open cases</h2><span className="muted">Highest risk first</span></div>
          <div className="card table-wrap">
            <table>
              <thead><tr><th>Person</th><th>Last day</th><th>Systems</th><th>Risk</th><th>Blocking</th></tr></thead>
              <tbody>
                {sorted.map((c) => {
                  const s = caseSummary(state, c);
                  const d = daysBetween(c.lastDay, today);
                  return (
                    <tr key={c.id} className="link" onClick={() => go(`/cases/${c.id}`)}>
                      <td><a href={`#/cases/${c.id}`} onClick={(e) => e.stopPropagation()}><b>{s.employee.name}</b></a><div className="muted" style={{ fontSize: "0.8rem" }}>{s.employee.title}{s.employee.type === "contractor" ? " · contractor" : ""}</div></td>
                      <td className="num">{day(c.lastDay)}<div className="muted" style={{ fontSize: "0.8rem" }}>{d > 0 ? `${d} days ago` : d === 0 ? "today" : `in ${-d} days`}</div></td>
                      <td style={{ minWidth: 120 }}><Bar ok={s.counts.verified} bad={s.counts.active} warn={s.counts.action} unk={s.counts.unknown} /><div className="muted num" style={{ fontSize: "0.78rem", marginTop: 4 }}>{s.counts.verified}/{s.accounts.length} verified</div></td>
                      <td><BandPill band={s.band} /></td>
                      <td className="num">{s.open.length} item{s.open.length === 1 ? "" : "s"}</td>
                    </tr>
                  );
                })}
                {sorted.length === 0 && <tr><td colSpan={5} className="empty">No open cases. Start one from People.</td></tr>}
              </tbody>
            </table>
          </div>

          {closed.length > 0 && (
            <>
              <div className="section-head" style={{ marginTop: 8 }}><h2>Closed</h2></div>
              <div className="card table-wrap">
                <table>
                  <tbody>
                    {closed.map((c) => {
                      const e = state.employees.find((x) => x.id === c.employeeId)!;
                      return (
                        <tr key={c.id} className="link" onClick={() => go(`/cases/${c.id}/receipt`)}>
                          <td><b>{e.name}</b> <span className="muted">· {e.department}</span></td>
                          <td className="num muted">Closed {when(c.closedAt)}</td>
                          <td><span className="pill verified">Complete</span></td>
                          <td style={{ textAlign: "right" }}><a href={`#/cases/${c.id}/receipt`} onClick={(ev) => ev.stopPropagation()}>Receipt OB-{c.id.slice(2)}</a></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <section className="section">
          <div className="section-head"><h2>Where the open items are</h2></div>
          <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {systems.map(([appId, n]) => {
              const app = state.apps.find((a) => a.id === appId)!;
              return (
                <div className="hbar" key={appId}>
                  <span className="row" style={{ flexWrap: "nowrap", gap: 6 }}><AppMark app={app} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.name}</span></span>
                  <span className="track"><i style={{ width: `${(n / maxSys) * 100}%` }} /></span>
                  <span className="num" style={{ textAlign: "right" }}>{n}</span>
                </div>
              );
            })}
            {systems.length === 0 && <p className="muted">Nothing open.</p>}
            <p className="muted" style={{ fontSize: "0.8rem" }}>Systems not behind Google sign-in (GitHub, AWS, Salesforce, 1Password) produce most leftovers: suspending the main account doesn’t touch them.</p>
          </div>

          <div className="section-head"><h2>Recent activity</h2><a href="#/evidence">Full audit log</a></div>
          <div className="card card-pad feed">
            {[...state.audit].reverse().slice(0, 7).map((e) => (
              <div className="ev" key={e.seq}>
                <time>{when(e.at)}</time>
                <div><b>{e.actor}</b> <span className="muted">{e.action}</span><div>{e.target}</div></div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Page>
  );
}
