import { useState } from "react";
import { useStore, go } from "../state";
import { AccessMap } from "./CaseView";
import { nextCaseId } from "../domain/store";
import { Avatar, Page } from "../components/ui";

export function People() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const depts = [...new Set(state.employees.map((e) => e.department))].sort();
  const rows = state.employees.filter((e) =>
    (!dept || e.department === dept) && (!q || `${e.name} ${e.email} ${e.title}`.toLowerCase().includes(q.toLowerCase())));
  const label = { active: "Active", leaving: "Leaving", offboarded: "Offboarded" };
  const cls = { active: "neutral", leaving: "action", offboarded: "verified" };

  return (
    <Page title="People" sub={`Synced from BambooHR and Google Workspace · ${state.employees.length} people`}>
      <div className="row">
        <input id="people-search" className="input" style={{ maxWidth: 280 }} placeholder="Search name, email or title" value={q} onChange={(e) => setQ(e.target.value)} />
        <select id="people-dept" className="input" style={{ maxWidth: 200 }} value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">All departments</option>
          {depts.map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Department</th><th>Type</th><th>Systems</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="link" onClick={() => go(`/people/${e.id}`)}>
                <td><a href={`#/people/${e.id}`} onClick={(ev) => ev.stopPropagation()}><b>{e.name}</b></a><div className="muted" style={{ fontSize: "0.8rem" }}>{e.title}</div></td>
                <td>{e.department}</td>
                <td>{e.type === "contractor" ? <span className="chip w">Contractor</span> : <span className="muted">Employee</span>}</td>
                <td className="num">{state.accounts.filter((a) => a.employeeId === e.id).length}</td>
                <td><span className={`pill ${cls[e.status]}`}>{label[e.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}

export function Person({ id }: { id: string }) {
  const { state, dispatch, toast } = useStore();
  const e = state.employees.find((x) => x.id === id);
  const [lastDay, setLastDay] = useState("2026-10-23");
  if (!e) return <Page title="Person not found"><a href="#/people">Back to people</a></Page>;
  const cases = state.cases.filter((c) => c.employeeId === e.id);
  const openCase = cases.find((c) => !c.closedAt);
  const assets = state.assets.filter((a) => a.employeeId === e.id);

  const start = (ev: React.FormEvent) => {
    ev.preventDefault();
    const id = nextCaseId(state);
    dispatch({ type: "open", employeeId: e.id, lastDay });
    toast(`Offboarding started for ${e.name}`);
    go(`/cases/${id}`);
  };

  return (
    <Page
      title={<span className="row" style={{ gap: 12 }}><Avatar name={e.name} />{e.name}</span>}
      sub={`${e.title} · ${e.department} · ${e.email}`}
    >
      {openCase ? (
        <div className="demo-bar"><span>Offboarding in progress (last day {openCase.lastDay}).</span><a href={`#/cases/${openCase.id}`}>Open case →</a></div>
      ) : e.status === "offboarded" ? (
        <div className="demo-bar"><span>Offboarded.</span>{cases[0] && <a href={`#/cases/${cases[0].id}/receipt`}>View receipt →</a>}</div>
      ) : (
        <form className="card card-pad row" style={{ alignItems: "flex-end", gap: 12 }} onSubmit={start}>
          <div style={{ flex: "1 1 260px" }}>
            <h2>Start offboarding</h2>
            <p className="muted">Builds {e.name.split(" ")[0]}’s access map from connected systems and creates a check for every system without an API.</p>
          </div>
          <label className="field"><span>Last working day</span><input id="last-day" type="date" className="input" value={lastDay} onChange={(x) => setLastDay(x.target.value)} required /></label>
          <button className="btn primary" type="submit">Start offboarding</button>
        </form>
      )}

      <section className="section">
        <div className="section-head"><h2>Digital footprint</h2><span className="muted">{state.accounts.filter((a) => a.employeeId === e.id).length} accounts</span></div>
        <AccessMap employeeId={e.id} />
      </section>

      {assets.length > 0 && (
        <section className="section">
          <h2>Equipment</h2>
          <div className="card table-wrap"><table><tbody>
            {assets.map((a) => <tr key={a.id}><td>{a.label}</td><td className="mono muted">{a.serial}</td><td style={{ textAlign: "right" }}><span className={`pill ${a.status === "returned" ? "verified" : "neutral"}`}>{a.status}</span></td></tr>)}
          </tbody></table></div>
        </section>
      )}
    </Page>
  );
}
