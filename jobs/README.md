# Root `jobs/` folder (legacy)

These scripts are **not** started by the root `package.json`. Production scheduling lives under **`server/src/workers/`** (e.g. `dailyPriceCheck.ts`).

| File | Role |
|------|------|
| `dailyCheck.ts` | Imports root `providers/` (Target-only `getBestPriceForItem`). **Orphan** unless you run it manually. |
| `price-monitor.ts` | Legacy; references old Amazon provider patterns. Verify before use. |
| `scheduler.ts` | Fully commented example (`node-cron`); not imported by the server. |

**Recommendation:** Delete or move to `legacy/jobs/` after confirming nothing in deployment references them. Do not confuse with `server/src/workers/`.
