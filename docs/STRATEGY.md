# Offboarding Control Center: strategy

**Decision: MODIFY, then validate before building the real product.**

Status: draft, 6 Oct 2026. Competitor facts and prices come from knowledge up to mid-2026 and have **not** been re-checked live. Verify them in Phase 0 before quoting them to anyone.

## 1. Verdict

The pain is real: leftover access in systems outside SSO, personal keys, OAuth grants, and resources only the leaver owns. A standalone "offboarding checklist" product for 20–250 person companies is weak:

- **It doesn't happen often enough.** A 50-person company offboards about 7–10 people a year, so it's hard to justify a subscription.
- **Vanta and Drata already collect offboarding evidence** for SOC 2 buyers, who are the people most willing to pay for proof.
- **Rippling and JumpCloud** bundle "one-click offboarding" into tools SMBs already buy.
- **Stitchflow** targets "verify offboarding, including apps without SCIM" directly. Zluri, Torii and Lumos keep moving down-market.

**The modified thesis:** continuous checks that leavers' access is really gone, with proof, for startups that face audits. The offboarding receipt is the hero feature. Ongoing reconciliation keeps the value weekly rather than once per departure:

1. **Offboarding verification and receipt.** This is the event-driven wedge and what the prototype shows.
2. **Weekly orphan sweep.** Look for ex-employees, contractors past their end date, keys and grants owned by inactive people, and resources with no owner.
3. **Quarterly user access review.** SOC 2 and ISO require it, it is painful, and teams already budget for it.
4. **Export into Vanta and Drata** rather than competing with them.

## 2. Where the competitors stop

| | Target | Rough price | Discovery | Verifies after the fact | Ownership transfer | Non-API apps | Fit for 20–250 |
|---|---|---|---|---|---|---|---|
| Okta (Workforce + LCM) | Mid/enterprise | ~$2–15/user/mo by module | Through SSO only | No, it pushes changes | Limited | No | Heavy |
| Microsoft Entra | Microsoft 365 shops | In M365 E3/E5 / P1–P2 | Entra-connected apps | Partly (sign-in logs) | No | No | OK if all-Microsoft |
| Rippling | SMB to mid | ~$8+/user/mo, IT add-ons | Its app store | Mostly trusts its own push | Some (Google) | Task list | Good, but only if you switch HRIS |
| JumpCloud | SMB | ~$9–24/user/mo | Directory and SSO | Partial | No | No | Good |
| BetterCloud | Mid/enterprise | Quote, five figures | Strong | Workflows | Strong (Google/M365) | No | Too expensive |
| Zluri / Torii / Lumos | Mid-market | Quote, usually $10k+/yr | SaaS discovery | Workflows | Some | Tasks | Too expensive for most |
| Stitchflow | Mid-market | Quote | Strong, including non-SCIM | **Yes, its core pitch** | Some | Yes (managed) | Closest competitor |
| Vanta / Drata | SOC 2 seekers | ~$10k+/yr | Connected integrations | Flags terminated-but-active | No | Manual evidence | Already in the account |
| Offboarder / OffboardSet / templates | Small teams | Cheap | None | No (checklists) | No | Checklist | Fits, but shallow |

**The gap:** nobody combines a cheap, fast setup with deep checks for hidden leftovers (keys, OAuth grants, repo, Drive and Slack ownership, IAM users outside SSO) and a receipt an auditor accepts.

## 3. Why would a 50-person company buy this over HRIS + Google Admin + a spreadsheet?

Only if one of these is true. Validate each.

- They have systems **outside Google/Microsoft sign-in** (GitHub without SAML, AWS IAM users, Salesforce local logins), so suspending Google gives false comfort.
- They face **SOC 2 / ISO audits or customer security questionnaires** and need dated, attributable evidence, not a ticked spreadsheet.
- They have had an **incident or a near miss**: an ex-employee's key in a pipeline, a contractor still in the repo, files deleted with an account.
- They **offboard often**: contractors, agencies, high churn.

If none apply, a spreadsheet wins, and you should not try to sell to them.

## 4. ICP

The primary buyer is a 30–200 person, engineering-heavy company running Google Workspace, GitHub and AWS, with SOC 2 done or under way, and no dedicated security or IAM person. The buyer is the IT/ops lead, the CTO, or the founder holding compliance.

MSPs are a second channel to test, not the main bet. In Microsoft 365-centric MSPs, CIPP (free) and existing automation tools are entrenched. The opening is MSPs and fractional-CISO or SOC 2 consultancies that serve tech startups on Google Workspace.

## 5. MVP integrations

Pick five, chosen to cover where leftovers actually hide:

| Integration | Why | Auth | Read | Revoke | Ownership | Complexity |
|---|---|---|---|---|---|---|
| **Google Workspace** | Directory, sign-in logs reveal other apps, Drive ownership, OAuth grants | Domain-wide delegation or admin OAuth. Restricted scopes need app verification and possibly a CASA assessment: **plan 4–8 weeks** | Users, tokens, login audit, Drive metadata | Suspend, revoke tokens, transfer Drive | Yes | Medium |
| **GitHub** | Access outside SSO, PATs, OAuth apps, repo admins, outside collaborators | GitHub App (short-lived installation tokens) | Members, collaborators, repo admins, PAT requests (fine-grained) | Remove member | Yes | Low–medium |
| **AWS** | Highest-impact leftovers: IAM users, access keys | Cross-account IAM role with External ID. **No stored keys** | IAM users, keys and last-used, policies, Identity Center assignments | Deactivate key (separate role) | Partly (tags, CloudTrail) | Medium |
| **Slack** | Channel managers, guests, apps | OAuth app | Users, channels. Admin APIs need Business+ or Enterprise | Plan-dependent | Partial | Low |
| **Microsoft 365** (alternative to Google) | Needed for half the market | Entra app, Graph API | Users, sign-ins, OneDrive | Disable, revoke sessions | Yes | Medium |

Defer Jira/Atlassian, Zoom, Notion and 1Password. Cover them with **manual verification**, which costs nothing per app and handles the long tail. Google sign-in logs show which of them people actually use.

## 6. Risk model

Implemented in `app/src/domain/risk.ts`.

- **Item score** = impact (1–5) × exposure (0.6 contained / 1.0 normal / 1.5 works without SSO) × recency (2.0 used after the last day / 1.25 used in the final week / 1.0), capped at 10.
- **Case score** = the worst item + 15% of the rest. One live admin key dominates; many trivial items don't add up to critical.
- **Bands:** 8+ critical, 5+ high, 2.5+ medium, above 0 low.
- **Override:** an admin can override the band with a required reason. The override is written to the audit log and stops applying once nothing is open.
- **Known false positives:** service accounts matched to a person, read-only keys, and repos with team admins we can't see. Matches below 90% confidence need a person to confirm.

## 7. Compliance claims: what we can and can't say

- **Can say:** the record is evidence for access-removal controls, for example SOC 2 CC6.2/CC6.3 and ISO 27001:2022 A.5.18 (access rights), A.5.11 (return of assets) and A.6.5 (responsibilities after termination). It also supports security questionnaire answers.
- **Can't say:** that it makes you compliant, that auditors will accept it, or that it lowers insurance premiums. Cyber insurance forms do ask about offboarding, but the effect on price is unproven.

## 8. Pricing (hypothesis to test)

$19/mo signals a toy and can't fund support for integrations. Per-offboarding pricing punishes the moments you want people to use the product. Pure per-seat pricing feels like an HRIS.

| Plan | US | India | Includes |
|---|---|---|---|
| Free | $0 | ₹0 | Manual checklist and receipt, 3 cases/yr. This is the lead magnet. |
| Team | **$149/mo** (≤100 people) | ₹4,999/mo | All integrations, hidden-risk detection, receipts, weekly orphan sweep |
| Growth | $299/mo (≤250) | ₹11,999/mo | Access reviews, Vanta/Drata export, SSO, auditor seats |
| MSP | $39/client/mo | ₹1,499/client/mo | Multi-tenant console |

Test $99, $149 and $249 for Team on the landing page.

## 9. Validation plan (Phase 0, 3–4 weeks, before more code)

**Hypotheses**

1. More than 40% of target companies have at least one system outside SSO where leavers' access survives.
2. More than 30% can name a real incident, audit finding or near miss caused by leftover access.
3. SOC 2 holders spend at least 2 hours per offboarding collecting evidence, or dread the access review.
4. Buyers will grant read-only admin access to a new vendor after seeing the security model.
5. At least 5 of 20 qualified prospects will pre-pay or sign an LOI at about $1.5k/yr.

**Interview questions** (ask about the past, don't pitch)

1. Walk me through the last person who left. What did you do, in what order, and who did it?
2. How did you know you had removed everything? What would you show an auditor?
3. Which systems don't go through Google/Microsoft sign-in?
4. Has an ex-employee or contractor ever kept access? How did you find out?
5. Who owned their repos, files and automations? What broke afterwards?
6. How do you handle the SOC 2 / ISO user access review today, and how long does it take?
7. What do Vanta / Rippling / your MSP already do here, and what do you still do by hand?
8. How many people and contractors left in the last 12 months?
9. What would stop you from connecting a new tool to Google admin, GitHub and AWS?
10. What have you paid to fix this before, whether tools, consultant hours or your own time?

**Signals that validate it:** specific stories, "I spent a day on the audit sample", "the contractor was still in GitHub", "Vanta flags it but I still have to go and check".

**Signals that kill it:** "Rippling or Okta handles it", "we're all on Google SSO", "we offboard twice a year", "we'd never connect AWS to a startup".

**Experiments**

- **Smoke test.** This prototype as a live demo, plus a landing page with "Get early access" and a pricing toggle. Success: more than 5% of qualified visitors sign up, and more than 20% of demos lead to a follow-up meeting.
- **Concierge test.** Run 5 real offboardings by hand, using read-only scripts plus a manual checklist, and hand over the receipt. Do customers find something they would have missed?
- **Competitor test.** Get trials of Vanta (or ask a customer), Rippling IT and Stitchflow. Document exactly what each misses on the John Smith scenario.
- **Pre-sales.** A design-partner offer at 50% off year one, paid upfront, with a refund if the MVP isn't delivered within 10 weeks.

**I would abandon it if any of these hold:**

- Fewer than 3 of 20 interviewees have a real leftover-access story.
- Vanta, Drata or Rippling customers say the existing tool already covers it.
- Read-only access is refused by most of them.
- Nobody pre-pays after 15 strong demos.

If that happens, the adjacent pivots are a lightweight user-access-review tool for SOC 2 (recurring and budgeted), or a services-led offering for SOC 2 consultants.

## 10. Roadmap

| Phase | Features | Integrations | Success metric | Exit criteria |
|---|---|---|---|---|
| 0 Validation (3–4 wk) | Clickable prototype (this repo), landing page, concierge offboardings | none | 20 interviews, 5 design partners | Validation hypotheses 1, 2 and 5 hold |
| 1 MVP (6–8 wk) | Real auth and tenancy, HRIS/CSV import, discovery, cases, manual checks, receipt PDF, audit log | Google, GitHub, AWS, Slack | 5 partners run real offboardings | Discovery finds at least one missed leftover for 3 of 5 partners |
| 2 Beta (8 wk) | Weekly orphan sweep, alerts (Slack/email), ownership transfer actions, Microsoft 365 | +M365, BambooHR/HiBob webhooks | Weekly active use between offboardings | Partners use it with nobody leaving |
| 3 Paid (8 wk) | Access reviews, Vanta/Drata export, billing, SOC 2 Type I for ourselves | +Atlassian, 1Password Events | 25 paying, under 3% monthly churn | $3k MRR, CAC payback under 6 months |
| 4 Scale | MSP console, more integrations, partner program | +Okta, Jira, Notion, Salesforce | 100 paying | Repeatable channel |

## 11. Go-to-market (first 10, 50 and 100 customers)

- **First 10:** founder-led. Reach SOC 2 / ISO consultants, fractional CISOs, and CTOs in startup communities. Offer a free "leftover access audit" of 3 recent leavers. That is the concierge test and also the sales motion.
- **First 50:** content on Reddit (r/sysadmin, r/ITManagers, r/msp) and LinkedIn built around real leftover stories, such as "the AWS key a CI pipeline was still using". Publish free tools: a GitHub sole-admin checker and an AWS IAM-users-outside-SSO script. Run a referral program for compliance consultants.
- **First 100:** a Vanta/Drata marketplace listing if possible, MSP and consultant partnerships with revenue share, and the Google Workspace Marketplace.
