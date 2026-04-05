## Refactoring: Extract Shared Render-Target Adapters

### Problem
`src/index.ts` currently hard-codes two separate render pipelines inside the MCP tool handlers instead of routing both tools through one shared abstraction. The tmux path in [`src/index.ts:109`](/Users/wdchen/Workspace/splash/src/index.ts#L109) to [`src/index.ts:131`](/Users/wdchen/Workspace/splash/src/index.ts#L131) and the browser path in [`src/index.ts:181`](/Users/wdchen/Workspace/splash/src/index.ts#L181) to [`src/index.ts:212`](/Users/wdchen/Workspace/splash/src/index.ts#L212) both resolve `dataFile` inputs, build the same `RenderMessage`, wait for a client, send the message, and map transport failures back into tool text.

That duplication is already visible in the helper layer. [`src/index.ts:82`](/Users/wdchen/Workspace/splash/src/index.ts#L82) to [`src/index.ts:89`](/Users/wdchen/Workspace/splash/src/index.ts#L89) and [`src/index.ts:162`](/Users/wdchen/Workspace/splash/src/index.ts#L162) to [`src/index.ts:169`](/Users/wdchen/Workspace/splash/src/index.ts#L169) implement the same polling loop with only different variable names and timeouts. The tool bodies then rebuild identical `RenderMessage` objects in [`src/index.ts:119`](/Users/wdchen/Workspace/splash/src/index.ts#L119) to [`src/index.ts:125`](/Users/wdchen/Workspace/splash/src/index.ts#L125) and [`src/index.ts:190`](/Users/wdchen/Workspace/splash/src/index.ts#L190) to [`src/index.ts:196`](/Users/wdchen/Workspace/splash/src/index.ts#L196).

The transport-specific setup is also mixed directly into the MCP layer. Tmux pane startup and IPC bootstrapping live beside tool wiring in [`src/index.ts:111`](/Users/wdchen/Workspace/splash/src/index.ts#L111) to [`src/index.ts:116`](/Users/wdchen/Workspace/splash/src/index.ts#L116), while browser startup, URL opening, image-path rewriting, and connection retries are embedded in [`src/index.ts:183`](/Users/wdchen/Workspace/splash/src/index.ts#L183) to [`src/index.ts:205`](/Users/wdchen/Workspace/splash/src/index.ts#L205). That makes every renderer-facing change re-open `src/index.ts`, even when the actual behavior belongs to a transport adapter. Upcoming work already queued in this run, such as actionable render errors and renderer-capability validation, will otherwise need to be threaded through two ad hoc branches again.

### Proposed Change
- Create a renderer-adapter module such as [`src/render-targets.ts`](/Users/wdchen/Workspace/splash/src/render-targets.ts) that defines a small shared contract for MCP-facing render targets, for example:
  - `prepare(spec, options) -> { spec, readyMessage?, successText }`
  - `waitForClient() -> Promise<boolean>`
  - `send(message) -> boolean`
  - `close()` where applicable
- Move the duplicated polling loop into one shared helper inside that module so tmux and browser only provide their timeout and readiness predicate instead of maintaining two near-identical `waitFor*Client()` functions in [`src/index.ts`](/Users/wdchen/Workspace/splash/src/index.ts).
- Extract one shared `dispatchRender()` function in [`src/index.ts`](/Users/wdchen/Workspace/splash/src/index.ts) that:
  - resolves `dataFile` references once
  - constructs the canonical `RenderMessage` once
  - delegates target-specific preparation such as browser image URL rewriting from [`src/index.ts:52`](/Users/wdchen/Workspace/splash/src/index.ts#L52) to [`src/index.ts:68`](/Users/wdchen/Workspace/splash/src/index.ts#L68)
  - returns standardized success and failure text to the tool handler
- Keep tmux-specific responsibilities in a `createTmuxTarget()` adapter that wraps `getIPC()`, `ensurePane()`, and IPC sending, and browser-specific responsibilities in a `createBrowserTarget()` adapter that wraps `createBrowserServer()`, `start()`, URL opening, and cached last-message behavior.
- Add focused tests in a new file such as [`src/render-targets.test.ts`](/Users/wdchen/Workspace/splash/src/render-targets.test.ts) that cover:
  - the shared wait helper timing out and succeeding
  - `dispatchRender()` building one `RenderMessage` shape for both targets
  - browser-target preparation rewriting local image paths without changing the tmux path
  - target-specific fallback text for "waiting for connection" versus "no renderer connected"

### Impact
- **Effort**: S
- **Risk**: Low
- **Value**: This reduces `src/index.ts` from two hand-maintained render flows to one shared pipeline with small target adapters. That lowers the cost of every subsequent renderer-facing change and makes behavior differences between tmux and browser explicit instead of accidental.

### Dependencies
No prerequisite feature work is required. This refactor should land before adding more MCP-side renderer logic so future DX and reliability work can hook into one dispatch path instead of duplicating behavior in both tool handlers.
