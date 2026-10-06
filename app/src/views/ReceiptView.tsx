import { useMemo } from "react";
import { useStore } from "../state";
import { buildReceipt } from "../domain/receipt";
import { Page, copy, day, when } from "../components/ui";

export function ReceiptView({ caseId }: { caseId: string }) {
  const { state, toast } = useStore();
  const c = state.cases.find((x) => x.id === caseId);
  const r = useMemo(() => (c ? buildReceipt(state, c.id) : null), [state, c]);
  if (!c || !r) return <Page title="Receipt not found"><a href="#/">Back to overview</a></Page>;

  const complete = !!c.closedAt;
  const counts = r.lines.reduce<Record<string, number>>((m, l) => ((m[l.method] = (m[l.method] ?? 0) + 1), m), {});

  const copyJson = async () => {
    const ok = await copy(JSON.stringify(r, null, 2));
    toast(ok ? "Evidence JSON copied" : "Copy blocked here. Select the digest below instead.");
  };

  return (
    <Page
      title={`Receipt ${r.number}`}
      sub={complete ? "Offboarding record for audit, security questionnaires and your own files." : "Draft. This case is still open, so the receipt is not final."}
      actions={<><a className="btn" href={`#/cases/${c.id}`}>Back to case</a><button className="btn primary" onClick={copyJson}>Copy evidence JSON</button></>}
    >
      <div className="receipt-wrap">
        <article className="receipt" aria-label="Offboarding receipt">
          <div className="spread" style={{ alignItems: "flex-start" }}>
            <div>
              <h2>OFFBOARDING RECEIPT</h2>
              <div className="muted">{r.organization} · {r.number}</div>
            </div>
            <span className={`stamp ${complete ? "" : "open"}`}>{complete ? "COMPLETE" : "NOT COMPLETE"}</span>
          </div>
          <hr />
          <dl className="kv">
            <dt>Person</dt><dd>{r.employee.name}</dd>
            <dt>Email</dt><dd>{r.employee.email}</dd>
            <dt>Role</dt><dd>{r.employee.title}, {r.employee.department}{r.employee.type === "contractor" ? " (contractor)" : ""}</dd>
            <dt>Last working day</dt><dd>{day(r.lastDay)}</dd>
            <dt>Case opened</dt><dd>{when(r.openedAt)} UTC</dd>
            <dt>Systems checked</dt><dd>{r.systemsChecked}</dd>
          </dl>
          <hr />
          <div className="label" style={{ marginBottom: 6 }}>Access and ownership</div>
          {r.lines.map((l, i) => (
            <div className="ln" key={i}>
              <span>{l.item}</span>
              <span className={`out ${l.outcome}`}>{l.outcome}</span>
              <span className="sub">{l.method} · {l.by} · {when(l.at)}{l.note ? ` · ${l.note}` : ""}</span>
            </div>
          ))}
          <hr />
          <div className="label" style={{ marginBottom: 6 }}>Equipment</div>
          {r.assets.map((a) => (
            <div className="ln" key={a.serial}><span>{a.label} <span className="muted">{a.serial}</span></span><span className="out">{a.status.toUpperCase()}</span></div>
          ))}
          <hr />
          <dl className="kv">
            <dt>Outstanding risks</dt><dd className="out">{r.outstanding}</dd>
            <dt>Exceptions</dt><dd>{r.exceptions}</dd>
            <dt>How verified</dt><dd>{Object.entries(counts).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(" · ")}</dd>
            <dt>Audit events</dt><dd>{r.auditEvents}, hash-chained</dd>
            <dt>Completed by</dt><dd>{r.closedBy ?? "—"}</dd>
            <dt>Completed at</dt><dd>{r.closedAt ? `${when(r.closedAt)} UTC` : "—"}</dd>
          </dl>
          <hr />
          <div className="label">SHA-256 of this record</div>
          <div className="digest">{r.digest}</div>
          <hr />
          <p className="muted" style={{ fontSize: "0.74rem" }}>
            “API re-check” means the system was read again after the change and showed no access. “Manual attestation” means a named person checked and recorded what they saw.
            This record is evidence you can give an auditor for access-removal controls (for example SOC 2 CC6.2/CC6.3 or ISO 27001 A.5.18 and A.5.11). It is not a certification of compliance.
          </p>
        </article>
      </div>
    </Page>
  );
}
