# NetSuite TypeScript Integration Framework

A production-grade SuiteScript 2.1 framework in TypeScript. Layered architecture
that separates script entry points, business logic, data access, and shared
utilities — making NetSuite customizations testable, maintainable, and reviewable.


## How It Works

### The Runtime Model

NetSuite runs JavaScript server-side on its own platform. You never deploy to a
traditional Node.js host — you upload compiled AMD modules to NetSuite's File
Cabinet, then attach them to Script records via the UI or SDF. The NetSuite
runtime loads your script, injects platform modules (N/record, N/search, N/log,
etc.), and invokes your exported entry point functions at specific lifecycle
moments.

This framework is written in TypeScript. `tsc` compiles it to AMD-format JS
(the only module format the NetSuite runtime understands). The `@hitc/netsuite-types`
package provides type definitions for every N/* module so you get full
autocomplete and compile-time safety, but those types are dev-only — they are
never deployed.

### Architecture (5 Layers)

Requests flow top-to-bottom. Each layer only calls the one directly below it.

```
┌─────────────────────────────────────────────────────────────┐
│  SCRIPTS (entry points)                                     │
│  Thin wrappers. Parse SuiteScript context, delegate down.   │
│  One file per script deployment. Never contains biz logic.  │
├─────────────────────────────────────────────────────────────┤
│  SERVICES (business logic)                                  │
│  Orchestrate DAOs, enforce business rules, coordinate       │
│  multi-record transactions, transform data for integrations.│
│  Each service extends BaseService for structured logging    │
│  and error normalization via this.execute(name, fn).        │
├─────────────────────────────────────────────────────────────┤
│  DAOs (data access objects)                                 │
│  Encapsulate N/record and N/search. One DAO per record      │
│  type, extending BaseDAO. Handle field mapping, sublist     │
│  insertion (static + dynamic mode), validation, and CRUD.   │
├─────────────────────────────────────────────────────────────┤
│  UTILS (cross-cutting concerns)                             │
│  Logger, governance helpers, search pagination, HTTP client │
│  with retry, typed error hierarchy. Shared by all layers.   │
├─────────────────────────────────────────────────────────────┤
│  CONSTANTS / TYPES (foundation)                             │
│  Enums for record types, statuses, execution contexts.      │
│  Field ID and sublist ID constants. TypeScript interfaces    │
│  for search results, RESTlet payloads, domain entities.     │
└─────────────────────────────────────────────────────────────┘
```

### Request Lifecycle Examples

**External API call hits the RESTlet:**
1. `rl_api_router.ts` receives the HTTP request, reads `action` from the body.
2. Routes map dispatches to the matching service method.
3. `SalesOrderService.createOrder()` validates business rules (min total, max
   500 lines, positive quantities).
4. Service calls `SalesOrderDAO.createFromData()` which maps typed data to
   `record.create()` + `record.setValue()` + sublist line insertion.
5. DAO returns the internal ID. Service logs the audit trail. RESTlet wraps
   the result in `{ success: true, data: { id } }`.
6. On any error, the typed error hierarchy (`ValidationError`, `RecordNotFoundError`,
   etc.) carries a machine-readable `code` field, and the RESTlet returns
   `{ success: false, error: { code, message } }`.

**Sales order saved in the UI (User Event):**
1. User clicks Save. NetSuite calls `beforeSubmit` on `ue_sales_order.ts`.
2. Script checks execution context (UI vs CSV import vs web services) and
   delegates validation to a service.
3. If validation fails, script throws — NetSuite blocks the save and shows
   the error to the user.
4. On success, NetSuite writes the record, then calls `afterSubmit`.
5. `afterSubmit` detects what changed (e.g., status transition) and triggers
   downstream actions: webhooks via `IntegrationService`, related record
   creation, notifications.

**Nightly batch job (Scheduled Script):**
1. NetSuite triggers `ss_batch_processor.ts` on a cron schedule.
2. Script reads deployment parameters (batch size, saved search ID).
3. `runSearch()` queries for pending records, auto-paginating through results.
4. For each record, the script calls the processing function, then checks
   `shouldYield()` — if remaining governance units drop below the threshold
   (default 100), it reschedules itself via `N/task` and exits.
5. Next invocation picks up where the last left off.

**High-volume parallel processing (Map/Reduce):**
1. `getInputData` returns a search or array — NetSuite pages through it.
2. `map` runs in parallel across NetSuite's server pool. Each invocation
   transforms one input row and emits key/value pairs.
3. `reduce` receives all values grouped by key and aggregates them.
4. `summarize` runs once at the end, iterates over errors from map/reduce
   stages, and logs the final report.

### Governance Model

Every SuiteScript execution has a unit budget. Simple operations (setValue,
getValue) cost 0-2 units; record loads cost 5-10; searches cost 10; saves
cost 20+. When you exhaust your budget, the script aborts.

This framework handles governance through:
- `shouldYield(threshold)` — returns true when remaining units <= threshold.
  Every processing loop checks this before the next iteration.
- `getRemainingUsage()` — raw unit count for logging/decisions.
- `logUsage(label)` — debug-level log of remaining units at loop boundaries.
- Scheduled scripts self-reschedule via N/task when governance runs low.
- Map/Reduce scripts get automatic governance per stage from the platform.
- `submitFields()` in the DAO uses the lighter-weight API when you only need
  to update body fields without loading the full record.

### Error Handling

The typed error hierarchy lets every layer classify failures without parsing
message strings:

```
Error
 └── NetSuiteError (code, message, details)
      ├── RecordNotFoundError     — RECORD_NOT_FOUND
      ├── ValidationError         — VALIDATION_ERROR (+ optional field)
      ├── GovernanceLimitError    — GOVERNANCE_LIMIT
      ├── IntegrationError        — INTEGRATION_ERROR (+ statusCode, responseBody)
      └── ConcurrencyError        — CONCURRENCY_ERROR
```

RESTlet responses, Map/Reduce summarize steps, and scheduled script error
handlers all switch on `error.code` to decide whether to retry, alert, or skip.

### Testing Strategy

Tests run in plain Node.js via Jest — no NetSuite runtime needed. The
`test/__mocks__/N/` directory provides drop-in mocks for every N/* module:

- **N/record** — in-memory Map-based store. Tracks body fields and sublist
  lines. `create()` returns a mock record, `save()` returns a numeric ID.
- **N/search** — `_setMockResults()` injects canned results. `create()`
  returns a search object whose `runPaged()` yields those results.
- **N/runtime** — `_setRemainingUsage(n)` controls governance for tests.
  `getCurrentScript()` returns a canned script ID and deployment.
- **N/log** — `_getLogs()` returns captured entries, `_clearLogs()` resets.
  Tests assert on log level, title, and details.

Jest's `moduleNameMapper` redirects `N/*` imports to these mocks automatically.


## Project Structure

```
src/
  constants/              Enums, field IDs, governance thresholds
    index.ts              RecordType, TransactionStatus, ExecutionContext,
                          Fields, Sublists, Governance
  types/                  Shared TypeScript interfaces
    index.ts              SearchFilter, SearchResultRow, RestletRequest/Response,
                          SalesOrderData, CustomerData, IntegrationConfig, etc.
  utils/
    logger.ts             Wraps N/log. Prefixes every entry with script ID.
    governance.ts         shouldYield(), getRemainingUsage(), getScriptParameter()
    errors.ts             NetSuiteError hierarchy (5 subclasses)
    search.ts             runSearch(), runSavedSearch(), lookupField(s)
    http.ts               get/post/put with retry on 408/429/5xx
    index.ts              Barrel export
  dao/
    BaseDAO.ts            Abstract CRUD: load, create, update, remove, submitFields
    SalesOrderDAO.ts      Typed SO creation with line-level validation
    CustomerDAO.ts        Typed customer creation with field mapping
    index.ts              Barrel export
  services/
    BaseService.ts        execute() wrapper: logging + error normalization
    SalesOrderService.ts  Order lifecycle: create, close, search, bulk update
    CustomerService.ts    Customer lifecycle: create with dedup, search, update
    IntegrationService.ts External sync: push, pull, webhooks, health check
    index.ts              Barrel export
  scripts/
    restlet/
      rl_api_router.ts    Route-based dispatcher for external API access
    userevent/
      ue_sales_order.ts   Record lifecycle hooks (beforeLoad/Submit, afterSubmit)
    scheduled/
      ss_batch_processor.ts  Governance-aware batch with self-reschedule
    mapreduce/
      mr_order_processor.ts  4-stage parallel processing pipeline
    suitelet/
      sl_integration_form.ts Custom UI form with server-side rendering
    client/
      cs_sales_order.ts   Browser-side field validation and UI behavior
test/
  __mocks__/N/            Jest mocks for N/log, N/runtime, N/record, N/search
src/*/__tests__/          Co-located test files (63 tests across 8 suites)
```


## Script Types

| Prefix | Type           | Entry Points                                     | Governance        |
|--------|----------------|--------------------------------------------------|-------------------|
| rl_    | RESTlet        | get, post, put, delete_                          | 5,000 units       |
| ue_    | User Event     | beforeLoad, beforeSubmit, afterSubmit            | 1,000 units       |
| ss_    | Scheduled      | execute                                          | 10,000 units      |
| mr_    | Map/Reduce     | getInputData, map, reduce, summarize             | 10,000 per stage  |
| sl_    | Suitelet       | onRequest                                        | 5,000 units       |
| cs_    | Client Script  | pageInit, fieldChanged, saveRecord, validateLine | 1,000 units       |


## Setup

```sh
npm install
npm run build        # Compile TypeScript → build/ (AMD modules)
npm test             # Run 63 tests with N/* mocks
npm run lint         # ESLint check
npm run deploy       # SuiteCloud CLI deploy to NetSuite (requires suitecloud.config.js)
```


## Adding a New Record Type

1. Add the record type to `RecordType` enum in `src/constants/index.ts`.
2. Add field ID constants if the record has custom fields.
3. Create `src/dao/MyRecordDAO.ts` extending `BaseDAO`.
4. Create `src/services/MyRecordService.ts` extending `BaseService`.
5. Create the script entry point in `src/scripts/<type>/`.
6. Add JSDoc tags: `@NApiVersion 2.1`, `@NScriptType`, `@NModuleScope SameAccount`.
7. Write tests using the mocks in `test/__mocks__/N/`.
8. Export from barrel files (`dao/index.ts`, `services/index.ts`).


## Naming Conventions

| Prefix | Script Type    | Example                        |
|--------|----------------|--------------------------------|
| rl_    | RESTlet        | rl_api_router.ts               |
| ue_    | User Event     | ue_sales_order.ts              |
| ss_    | Scheduled      | ss_batch_processor.ts          |
| mr_    | Map/Reduce     | mr_order_processor.ts          |
| sl_    | Suitelet       | sl_integration_form.ts         |
| cs_    | Client Script  | cs_sales_order.ts              |

Services: `<Entity>Service.ts` (PascalCase)
DAOs: `<Entity>DAO.ts` (PascalCase)
Constants: lowercase with underscores in the enum values


## Deploying with GitHub Actions

`npm run build` compiles to `build/`, `npm run stage` copies that into
`suitecloud/src/FileCabinet/SuiteScripts/netsuite-ts-framework/`, and the
SuiteCloud CLI uploads it to NetSuite.

| Workflow | Trigger | Does |
|---|---|---|
| `ci.yml` | PRs, pushes to main | lint, test, build, stage, upload artifact |
| `deploy-sandbox.yml` | push to main, manual | build and deploy to the `sandbox` account |
| `deploy-production.yml` | `v*` tag, manual (dry run default) | build and deploy to the `production` account |
| `deploy-netsuite.yml` | reusable | shared build, auth, validate, deploy steps |

Setup TODOs:
1. Create GitHub Environments `sandbox` and `production` (add required reviewers to production).
2. In each NetSuite account, create an Integration record with OAuth 2.0 client
   credentials (certificate) for a deploy role.
3. Add Environment secrets: `NS_ACCOUNT_ID`, `NS_CERTIFICATE_ID`, `NS_PRIVATE_KEY`.
4. Verify `suitecloud account:setup:ci` flags against your CLI version.
5. Add Script/Deployment XML objects under `suitecloud/src/Objects/` and enable
   them in `suitecloud/src/deploy.xml`. Until then, deploys only upload files.
