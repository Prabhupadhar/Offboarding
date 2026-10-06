import { useState } from "react";
import { useStore, go } from "../state";
import { band, explain, findingScore } from "../domain/risk";
import { AppMark, Page } from "../components/ui";

export function Risks() {
  const { state } = useStore();
  const [filter, setFilter] = useState<"all" | "critical" | "high" | "medium" | "low">("all");
  const rows = state.findings
    .filter((f) => f.status === "open")
    .map((f) => {
      const c = state.cases.find((x) => x.id === f.caseId)!;
      return { f, c, score: findingScore(f, c.lastDay), person: state.employees.find((e) => e.id === c.employeeId)! };
    })
    .filter((r) => !r.c.closedAt)
    .sort((a, b) => b.score - a.score);
  const shown = rows.filter((r) => filter === "all" || band(r.score) === filter);
  const count = (b: string) => rows.filter((r) => band(r.score) === b).length;

  return (
    <Page title="Open risks" sub="Everything still unresolved across open cases, worst first.">
      <div className="row" role="group" aria-label="Filter by risk">
        {(["all", "critical", "high", "medium", "low"] as const).map((b) => (
          <button key={b} className={`btn sm ${filter === b ? "primary" : ""}`} onClick={() => setFilter(b)}>
            {b === "all" ? `All · ${rows.length}` : `${b[0].toUpperCase()}${b.slice(1)} · ${count(b)}`}
          </button>
        ))}
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Score</th><th>Item</th><th>Person</th><th>Why</th></tr></thead>
          <tbody>
            {shown.map(({ f, c, score, person }) => {
              const app = state.apps.find((a) => a.id === f.appId);
              const b = band(score);
              return (
                <tr key={f.id} className="link" onClick={() => go(`/cases/${c.id}`)}>
                  <td><span className={`pill ${b}`}><span className="num">{score.toFixed(1)}</span></span></td>
                  <td><div className="cell-app"><AppMark app={app} /><span>{f.title}</span></div></td>
                  <td>{person.name}</td>
                  <td><div className="row" style={{ gap: 4 }}>{explain(f, c.lastDay).map((r) => <span className="chip" key={r}>{r}</span>)}</div></td>
                </tr>
              );
            })}
            {shown.length === 0 && <tr><td colSpan={4} className="empty">Nothing at this level.</td></tr>}
          </tbody>
        </table>
      </div>

      <details className="card card-pad">
        <summary>How the score works</summary>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12, maxWidth: "72ch" }}>
          <p><b>Item score = impact × exposure × recency</b>, capped at 10.</p>
          <p><b>Impact (1–5)</b>: what someone could do with it. 5 is admin or production cloud access, or a long-lived key. 4 is an account in a system with source code or customer data. 3 is a connected app with write access, or access we couldn’t check. 2 is something they own that has no new owner. 1 is low-sensitivity leftovers.</p>
          <p><b>Exposure</b>: ×1.5 if it works from the internet without your SSO (keys, tokens, local passwords). ×1.0 for normal sign-in. ×0.6 if it only works inside a system that’s already locked.</p>
          <p><b>Recency</b>: ×2 if it was used after the last day. ×1.25 if used in the final week. Otherwise ×1.</p>
          <p><b>Case score</b> = the worst item + 15% of the rest. One live admin key makes a case critical; ten minor leftovers don’t.</p>
          <p><b>Levels</b>: 8+ critical · 5+ high · 2.5+ medium · above 0 low.</p>
          <p className="muted">Known false positives: service accounts matched to a person, keys already scoped read-only, and repos with a team admin we can’t see. An admin can override a case’s level with a reason, and the override is written to the audit log.</p>
        </div>
      </details>
    </Page>
  );
}
