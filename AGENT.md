# AGENT.md — Shopfloor

## Project Identity

This is an open-source NetSuite SuiteScript 2.1 TypeScript starter aimed at
small companies, light manufacturers, and local shops. Business rules live in
`src/profiles/` (plain data) and `src/domain/` (pure functions, no N/* imports).
New business logic should follow that split: math in domain, NetSuite access
in DAOs, orchestration in services. New modules must default to dry run.

It compiles to AMD
modules deployed to NetSuite's server-side JavaScript runtime via the SuiteCloud
CLI or File Cabinet upload. It is NOT a Node.js application — there is no
Express server, no package runtime, no Docker container. The N/* modules
(N/record, N/search, N/log, N/runtime, etc.) are injected by the NetSuite
platform at execution time.

## Architecture Rules

### Layer Discipline (mandatory)

```
Scripts → Services → DAOs → N/* modules
               ↘ Utils ↗
```

- Scripts are THIN. They parse the SuiteScript context object and call a service
  method. Zero business logic in scripts.
- Services own business rules, multi-record coordination, and data transformation.
  Every public method must go through `this.execute(name, fn)` for logging and
  error normalization.
- DAOs own N/record and N/search calls. One DAO per record type, extending
  BaseDAO. Scripts and services NEVER call `record.load()`, `record.create()`,
  or `search.create()` directly.
- Utils are stateless. Logger, governance, search helpers, HTTP client, errors.

### Governance is Non-Negotiable

Every loop that processes records MUST check `shouldYield()` before each
iteration. If you skip the governance check, the script will abort mid-execution
when it runs out of units, leaving data in an inconsistent state.

- Scheduled scripts: check `shouldYield()` → reschedule self via N/task → return
- Map/Reduce: governance is per-stage automatic, but still check in reduce if
  doing heavy work per key
- RESTlets / User Events: governance budgets are smaller (1,000-5,000 units) —
  never do unbounded loops
- Prefer `submitFields()` over load+modify+save when updating only body fields

### Error Handling

All errors must use the typed hierarchy (NetSuiteError subclasses). Never throw
raw Error objects from services or DAOs — the RESTlet router and Map/Reduce
summarize stages depend on `error.code` to classify failures.

When catching errors in afterSubmit or scheduled scripts, LOG but do not
re-throw unless you want to abort the entire execution. The record is already
saved in afterSubmit — re-throwing just creates noise.

### Search Patterns

- Use `runSearch()` or `runSavedSearch()` from utils/search.ts — they handle
  pagination and governance automatically.
- Use `lookupFields()` when you need 1-3 fields from a known record ID — it is
  far cheaper than loading the full record.
- Never use `search.run().each()` — it has a hard 4,000-result limit with no
  pagination. Always use `runPaged()` (which our helpers wrap).

## File Organization

```
src/constants/index.ts      — RecordType, TransactionStatus, ExecutionContext, Fields, Sublists, Governance
src/types/index.ts          — All shared interfaces (SearchFilter, RestletRequest, domain entities)
src/utils/*.ts              — Logger, governance, errors, search, http (barrel: utils/index.ts)
src/dao/*.ts                — BaseDAO + one concrete DAO per record type (barrel: dao/index.ts)
src/services/*.ts           — BaseService + domain services (barrel: services/index.ts)
src/scripts/<type>/<prefix>_<name>.ts — Script entry points (6 types)
test/__mocks__/N/*.ts       — Jest mocks for N/log, N/runtime, N/record, N/search
src/*/__tests__/*.test.ts   — Co-located tests
```

## How to Add a New Feature

### New Record Type
1. Add to `RecordType` enum in constants.
2. Create DAO extending BaseDAO (field mappings + validation).
3. Create Service extending BaseService (business rules + orchestration).
4. Create script entry point with JSDoc tags.
5. Write tests using N/* mocks.
6. Export from barrel files.

### New RESTlet Action
1. Add handler function in the script or (preferred) in a service.
2. Register in the `routes` map in `rl_api_router.ts`.
3. The router handles error wrapping automatically.

### New Scheduled Job
1. Create `ss_<name>.ts` with `execute` export.
2. Query for work via `runSearch()`.
3. Process in a loop with `shouldYield()` guard.
4. Call `reschedule()` if work remains when governance is low.

### New Integration Endpoint
1. Define the payload types in `src/types/index.ts`.
2. Add methods to `IntegrationService` or create a new service.
3. Use `utils/http.ts` (get/post/put) — it handles retry and structured errors.
4. Wire it into the appropriate script (afterSubmit hook, scheduled job, RESTlet).

## Testing Conventions

- Tests live in `__tests__/` directories co-located with the code they test.
- Every test file imports from `test/__mocks__/N/` via Jest moduleNameMapper.
- Call `_clearLogs()` in `beforeEach` to reset the log capture.
- Call `_setRemainingUsage(n)` to test governance behavior at specific thresholds.
- Call `_setMockResults([...])` to inject search results for service-level tests.
- Test validation at the service layer (business rules) and DAO layer (field
  requirements) separately.

## TypeScript Gotchas in This Codebase

- `tsconfig.json` uses `module: AMD` — this is required, not optional.
- `esModuleInterop` is false — SuiteScript modules are AMD, not ESM.
- Cast search operators via `as unknown as search.Operator` (the @hitc types
  use a branded enum that won't accept plain strings).
- Coerce `result.recordType` with `String()` — it's a branded Type, not string.
- `as const` is compile-time only — don't assert `Object.isFrozen()` at runtime.
- Unused function parameters in mocks need underscore prefix (`_options`) because
  `noUnusedParameters` is enabled.

## Build and Deploy

```sh
npm run build      # tsc → build/   (AMD .js files)
npm test           # Jest with N/* mocks
npm run lint       # ESLint
npm run deploy     # suitecloud project:deploy (needs suitecloud.config.js)
```

The build/ directory mirrors src/ structure. Upload to NetSuite's File Cabinet
under SuiteScripts/, then create/update Script records pointing to the compiled
.js files.
