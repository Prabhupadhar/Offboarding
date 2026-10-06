# Offboarding Control Center: prototype

This is a clickable prototype of an offboarding-verification product for 20–250 person companies. Its purpose is to answer *"Know exactly what a leaver can still get into, and prove the offboarding is complete."* It is meant for validation demos, not production.

- `docs/STRATEGY.md`: verdict, competitors, ICP, integrations, pricing, validation plan and kill criteria
- `docs/ARCHITECTURE.md`: MVP stack, data model, security design, API sketch
- `app/`: the prototype (React + TypeScript + Vite). Integrations are simulated.

## Run it

```bash
cd app
npm install
npm run dev            # http://localhost:5173
npm test               # domain tests: risk engine, workflow, receipt, audit chain
npm run build:artifact # single-file HTML in app/dist-artifact/
```

## Demo script (3 minutes)

1. **Overview.** Three people are being offboarded, there are 17 open risks, and two people still have live access after their last day.
2. **John Smith's case.** 12 systems were discovered: 8 verified, 2 need a person, 2 still active (GitHub, AWS). Behind those sit an AWS admin IAM user, an access key used *after* his last day by a CI pipeline, 2 OAuth grants, 2 repos where he is the sole admin, a Drive folder shared externally, and a Slack channel only he manages.
3. **Resolve the items.** Revoke, transfer ownership, verify by hand (with a note and screenshot), or accept the risk with a reason.
4. **Close the case.** This issues receipt OB-1042, stamped COMPLETE, with a SHA-256 digest. Every step is in the hash-chained audit log (Evidence & audit → Verify chain).

Use **Settings → Reset demo data** to start over.
