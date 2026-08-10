---
name: run-fact-friends
description: Run, drive, screenshot, and smoke-test the Fact Friends app in a headless browser. Use when asked to run or start the app, take a screenshot of a page, click through the teacher editor or the student quiz, verify a UI change in the real app, or reproduce a bug end to end.
---

# Run Fact Friends

SvelteKit front end on port 8000, PocketBase behind it on 8090. Both are
normally **already running** on this VM and serve the user's live site — check
before you start anything.

Paths below are relative to the repo root (`/home/exedev/code`).

The app is driven by `.claude/skills/run-fact-friends/driver.mjs`, a Playwright
harness. This container has **no `chromium-cli`**, so Playwright is the handle
on the running app.

## Prerequisites

Playwright is a devDependency; the browser binary is not, and lives in
`~/.cache/ms-playwright`. Once per machine:

```bash
bun install
bunx playwright install chromium
```

No `apt-get` and no `xvfb` needed — Chromium runs headless here.

## Is it already up?

```bash
curl -sf -o /dev/null -w "app %{http_code}\n" http://localhost:8000/
curl -sf -o /dev/null -w "pocketbase %{http_code}\n" http://127.0.0.1:8090/api/health
```

Both `200` → **leave them alone.** Port 8000 is `vite dev`, which is the user's
live editing site; it hot-reloads your edits, so there is nothing to restart.

Only if the app is down:

```bash
./pocketbase serve &     # 127.0.0.1:8090
bun run dev &            # 0.0.0.0:8000
timeout 60 bash -c 'until curl -sf http://localhost:8000 >/dev/null; do sleep 1; done'
```

## Run (agent path)

```bash
node .claude/skills/run-fact-friends/driver.mjs seed    # build a fixture
node .claude/skills/run-fact-friends/driver.mjs smoke   # walk the main flows
```

`seed` signs up a throwaway teacher, makes a class, imports a quiz, builds a
one-step progression, joins a student, assigns and releases an attempt. It
writes `.fixture.json` and `.teacher-state.json` beside the driver, so later
commands reuse the same class without redoing any of it.

`smoke` covers what the recent commits actually touch, and prints what to
expect beside each result:

```
editor import: dialog "Import questions", api ["/api/import/read"]
export dropdown open: true
finished-message popover open: true
library import: dialog "Import", api ["/api/import/read","/api/import"]
typed 12abc!@#3x -> "123" (expect 123)
caret 45 + Home + q7 -> "745" (expect 745)
results: Nice try! | 2/3 | CORRECT | ...
```

The `api [...]` lines are the load-bearing assertion for imports: the editor
path must hit **only** `/api/import/read`. If `/api/import` shows up there, the
editor filed a quiz in the library instead of handing it back to the draft.

Screenshots land in `.claude/skills/run-fact-friends/shots/`. **Open them** —
`smoke` passing its printed checks does not mean the page looks right.

Other commands:

```bash
node .claude/skills/run-fact-friends/driver.mjs shot /teacher/home home
node .claude/skills/run-fact-friends/driver.mjs student-shot quiz student-quiz
node .claude/skills/run-fact-friends/driver.mjs release
```

`shot <path> [name]` screenshots any page signed in as the seeded teacher and
prints the page text. `student-shot quiz` lands on the student's released quiz.
`release` grants another attempt — needed because handing a quiz in consumes
the student's one attempt (see Gotchas).

For a one-off flow, import the driver's shape rather than extending it: copy
the `browser()` / `watch()` / `teacherPage()` helpers into a scratch `.mjs` in
your scratchpad and drive from there.

## Check types before you drive

`vite build` compiles without type-checking anything, so a bad prop or a
non-existent icon name builds clean and fails silently in the browser. Both
have reached production this way.

```bash
bun run check    # svelte-check; 0 errors, 3 known a11y warnings
```

## Run (human path)

`bun run dev` serves on 8000, reachable at
`https://math-formative-quizzes.dev.edtechathon.com`. Never hand the user a
localhost URL or a port number.

## Gotchas

- **Releasing goes through `confirm()`.** Without `page.on("dialog", d => d.accept())`
  the click silently does nothing — no request, no error, the button just stays
  as it was. `watch()` in the driver installs this on every page.
- **One attempt per release.** Handing a quiz in sets `released: false`, so the
  student's Start button disappears. A second run needs `driver.mjs release`
  first; `student-shot quiz` throws a clear error when there is nothing to sit.
- **Creating a class redirects to `/teacher/home`, not to the class.** The id has
  to be scraped from the class links — and `/teacher/classes/new` is one of
  those links, so a naive "first href" grabs the literal string `new` and every
  later page 404s in a confusing way.
- **Sign-up tab vs submit button.** Both match `getByRole("button", { name: /Create account/ })`.
  Use `.tabs button` for the tab.
- **The assign dialog's confirm button is `Assign 1 progression`**, not `Assign` —
  `hasText: /^Assign$/` never matches and times out after 30s.
- **The import dialog's file input is `.sr-only`.** Don't click it; use
  `setInputFiles` on `.import-dialog input[type=file]`. It takes JSON as well as
  PDF, which is why the driver ships a JSON fixture instead of a binary.
- **Answer boxes accept digits only.** Typing letters leaves the box *empty*, so
  on a progression requiring every answer the Hand in button stays disabled.
  Type at least one digit per box or the submit will hang.
- **Clipboard tests need explicit permission**: `newContext({ permissions: ["clipboard-read", "clipboard-write"] })`,
  otherwise `navigator.clipboard.writeText` throws `NotAllowedError`.
- **`NODE_PATH` does not work.** The driver is ESM; Node ignores `NODE_PATH` for
  `import`. Playwright has to resolve from the repo's own `node_modules`.
- **Seeding leaves data behind.** Each `seed` creates a new throwaway teacher
  (`t<timestamp>@example.org`) and a "Driver Test Class" in the dev database.
  Harmless and invisible to the user's own account, but it accumulates.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ERR_MODULE_NOT_FOUND: playwright` | `bun install` — it must resolve from the repo, not a scratch dir |
| `browserType.launch: Executable doesn't exist` | `bunx playwright install chromium` |
| `locator.click: element is not enabled` on Hand in | An answer box is empty; letters strip to nothing |
| `no released quiz` from `student-shot` | `driver.mjs release` |
| Release click does nothing, no network request | Missing `dialog` handler — see Gotchas |
| Timeout on `/^Assign$/` | The button reads `Assign 1 progression` |
