// Drives Fact Friends in a headless browser. This container has no
// chromium-cli, so Playwright is the handle on the running app.
//
//   node .claude/skills/run-fact-friends/driver.mjs <command>
//
// Commands:
//   seed                       Build a whole fixture: teacher, class, quiz,
//                              progression, student, released attempt.
//                              Writes .claude/skills/run-fact-friends/.fixture.json
//   smoke                      seed, then walk both import paths and sit a quiz.
//   release                    Release another attempt for the seeded student.
//   shot <path> [name]         Screenshot any page signed in as the teacher.
//   student-shot <path|quiz> [name]
//                              Screenshot a page as the seeded student. Pass
//                              "quiz" to land on their released quiz.
//
// Screenshots land in .claude/skills/run-fact-friends/shots/.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, "shots");
const FIXTURE = join(HERE, ".fixture.json");
const STATE = join(HERE, ".teacher-state.json");
const BASE = process.env.FF_BASE ?? "http://localhost:8000";
mkdirSync(SHOTS, { recursive: true });

// One quiz, as a teacher would export it. The import dialog takes JSON as
// happily as PDF, and JSON keeps this driver from depending on a binary
// fixture. See skills/create-fact-friends-json for the full shape.
const QUIZ_JSON = join(HERE, ".quiz.json");
writeFileSync(QUIZ_JSON, JSON.stringify({
  title: "Imported sevens drill",
  timeLimitMinutes: 3,
  showScore: true,
  passMessage: "Great work! You finished this quiz.",
  problems: [
    { id: "i1", op: "multiplication", top: 7, bottom: 1 },
    { id: "i2", op: "multiplication", top: 7, bottom: 2 },
    { id: "i3", op: "multiplication", top: 7, bottom: 3 },
  ],
}, null, 2));

const log = (...a) => console.log(...a);
const fixture = () => JSON.parse(readFileSync(FIXTURE, "utf8"));

async function browser() {
  return chromium.launch({ args: ["--no-sandbox"] });
}

// Every page gets these: a confirm() that answers itself (releasing an
// attempt goes through one), and loud reporting of anything the page throws.
function watch(page, tag = "page") {
  page.on("pageerror", (e) => log(`!! ${tag} threw:`, e.message));
  page.on("dialog", (d) => d.accept());
  page.on("console", (m) => { if (m.type() === "error") log(`!! ${tag} console:`, m.text()); });
  return page;
}

async function teacherPage(b) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 }, storageState: STATE });
  return watch(await ctx.newPage(), "teacher");
}

async function seed() {
  const b = await browser();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } });
  const page = watch(await ctx.newPage(), "teacher");
  const email = `t${Date.now()}@example.org`;

  // Sign up. The tab and the submit button are both reachable by role, so
  // reach for the tab by its container instead.
  await page.goto(`${BASE}/teacher`, { waitUntil: "networkidle" });
  await page.locator(".tabs button", { hasText: "Create account" }).click();
  await page.fill("#name", "Driver Teacher");
  await page.fill("#email", email);
  await page.fill("#password", "password12345");
  await page.locator("form button[type=submit]").click();
  await page.waitForURL((u) => !u.pathname.endsWith("/teacher"), { timeout: 20000 });

  // Creating a class lands back on /teacher/home, not on the new class, so
  // the id has to be read off the class links — and "new" is one of them.
  await page.goto(`${BASE}/teacher/classes/new`, { waitUntil: "networkidle" });
  await page.fill("#class-name", "Driver Test Class");
  await page.locator("button.create-class").click();
  await page.waitForURL(/\/teacher\/(home|classes)/, { timeout: 20000 });
  await page.goto(`${BASE}/teacher/home`, { waitUntil: "networkidle" });
  const hrefs = await page.locator('a[href*="/teacher/classes/"]').evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  const classId = hrefs.map((h) => h.match(/classes\/([^/?]+)/)[1]).find((id) => id !== "new");

  const code = (await page.locator("body").innerText()).match(/Class code\s+(\d{6})/)?.[1]
    ?? (await (await teacherClassCode(page, classId)));
  log("class", classId, "code", code);

  // A quiz to hang everything off, imported rather than typed out.
  await page.goto(`${BASE}/teacher/classes/${classId}/quizzes`, { waitUntil: "networkidle" });
  await page.locator(".workspace-heading-actions button", { hasText: "Import" }).click();
  await page.waitForSelector(".import-dialog");
  await page.locator(".import-dialog input[type=file]").setInputFiles(QUIZ_JSON);
  await page.waitForSelector(".import-item");
  await page.locator(".import-dialog button.editor-save").click();
  await page.waitForTimeout(2500);

  // A progression, so the quiz has a step a student can be released into.
  await page.goto(`${BASE}/teacher/classes/${classId}/progressions/new`, { waitUntil: "networkidle" });
  await page.locator('input[placeholder="Untitled path"]').fill("Driver path");
  await page.getByRole("button", { name: /Imported sevens drill/ }).click();
  await page.getByRole("button", { name: "Save progression" }).click();
  await page.waitForTimeout(2500);

  await ctx.storageState({ path: STATE });

  // A student, joining with the class code.
  const sctx = await b.newContext({ viewport: { width: 1100, height: 900 } });
  const s = watch(await sctx.newPage(), "student");
  await s.goto(`${BASE}/join/${code}`, { waitUntil: "networkidle" });
  await s.locator('input[type="text"], input:not([type])').first().fill("Ada Driver");
  await s.locator("form button[type=submit]").first().click();
  await s.waitForTimeout(2000);

  // Assign, then release. Both are needed before a quiz is sittable, and the
  // release button stays disabled until somebody is waiting on it.
  await page.goto(`${BASE}/teacher/classes/${classId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Assign" }).click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /Select all/ }).click();
  await page.waitForTimeout(300);
  await page.locator("input[type=checkbox]").last().check().catch(() => {});
  await page.getByRole("button", { name: /Assign \d+ progression/ }).click();
  await page.waitForTimeout(2500);

  await page.goto(`${BASE}/teacher/classes/${classId}/progressions`, { waitUntil: "networkidle" });
  const releaseButton = page.getByRole("button", { name: /Release \d+/ });
  if (await releaseButton.count()) { await releaseButton.first().click(); await page.waitForTimeout(2500); }

  const out = { classId, code, email, student: "Ada Driver" };
  writeFileSync(FIXTURE, JSON.stringify(out, null, 2));
  log("SEEDED", JSON.stringify(out));
  await b.close();
  return out;
}

// Handing a quiz in consumes the student's one attempt, so anything that wants
// a sittable quiz twice has to release another one first.
async function release() {
  const fx = fixture();
  const b = await browser();
  const page = await teacherPage(b);
  await page.goto(`${BASE}/teacher/classes/${fx.classId}/progressions`, { waitUntil: "networkidle" });
  const button = page.getByRole("button", { name: /Release \d+/ });
  if (!(await button.count())) log("nothing waiting — every student already has an attempt");
  else { await button.first().click(); await page.waitForTimeout(2500); log("released"); }
  await b.close();
}

async function teacherClassCode(page, classId) {
  await page.goto(`${BASE}/teacher/classes/${classId}`, { waitUntil: "networkidle" });
  return (await page.locator("body").innerText()).match(/Class code\s+(\d{6})/)?.[1];
}

// Join as the seeded student and land on a released quiz.
async function studentQuiz(b, fx) {
  const ctx = await b.newContext({ viewport: { width: 1100, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
  const s = watch(await ctx.newPage(), "student");
  await s.goto(`${BASE}/join/${fx.code}`, { waitUntil: "networkidle" });
  await s.locator('input[type="text"], input:not([type])').first().fill(fx.student);
  await s.locator("form button[type=submit]").first().click();
  await s.waitForTimeout(2000);
  const start = s.locator('a[href*="/quiz/"]').first();
  if (!(await start.count())) throw new Error("no released quiz — run `seed` again, an attempt is consumed on hand-in");
  await start.click();
  await s.waitForSelector(".quiz-answer", { timeout: 15000 });
  return s;
}

async function smoke() {
  const fx = existsSync(FIXTURE) ? fixture() : await seed();
  const b = await browser();
  const page = await teacherPage(b);
  const imports = [];
  page.on("request", (r) => { if (r.url().includes("/api/import")) imports.push(new URL(r.url()).pathname); });

  // 1. Import into the quiz being edited: hands the quiz back, creates nothing.
  await page.goto(`${BASE}/teacher/classes/${fx.classId}/quizzes/new`, { waitUntil: "networkidle" });
  await page.locator("header.editor-bar button", { hasText: "Import" }).click();
  await page.waitForSelector(".import-dialog");
  const editorTitle = await page.locator(".import-head h2").textContent();
  await page.locator(".import-dialog input[type=file]").setInputFiles(QUIZ_JSON);
  await page.waitForSelector(".import-item");
  await page.locator(".import-dialog button.editor-save").click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(SHOTS, "editor-import.png") });
  log(`editor import: dialog "${editorTitle.trim()}", api ${JSON.stringify(imports)}`);
  log(`  expect ["/api/import/read"] only — /api/import means it filed a library quiz`);

  // 2. The editor bar popovers stay up on the click that opens them.
  await page.locator("button.export-trigger").click();
  await page.waitForTimeout(500);
  log("export dropdown open:", (await page.locator(".export-dropdown").count()) > 0);
  await page.keyboard.press("Escape");
  await page.locator('button[aria-label="Finished message"]').click();
  await page.waitForTimeout(500);
  log("finished-message popover open:", (await page.locator(".bar-popover").count()) > 0);
  await page.screenshot({ path: join(SHOTS, "editor-popovers.png") });

  // 3. Import from the library: this one really does create a quiz.
  imports.length = 0;
  await page.goto(`${BASE}/teacher/classes/${fx.classId}/quizzes`, { waitUntil: "networkidle" });
  await page.locator(".workspace-heading-actions button", { hasText: "Import" }).click();
  await page.waitForSelector(".import-dialog");
  const libTitle = await page.locator(".import-head h2").textContent();
  await page.locator(".import-dialog input[type=file]").setInputFiles(QUIZ_JSON);
  await page.waitForSelector(".import-item");
  await page.locator(".import-dialog button.editor-save").click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: join(SHOTS, "library-import.png"), fullPage: true });
  log(`library import: dialog "${libTitle.trim()}", api ${JSON.stringify(imports)}`);
  log(`  expect both /api/import/read and /api/import`);

  // 4. A student sits the quiz. Answers take digits only.
  const s = await studentQuiz(b, fx);
  const box = s.locator(".quiz-answer").first();
  await box.click();
  await box.type("12abc!@#3x");
  log("typed 12abc!@#3x ->", JSON.stringify(await box.inputValue()), "(expect 123)");
  await box.fill("");
  await box.type("45");
  await box.press("Home");
  await box.type("q7");
  log("caret 45 + Home + q7 ->", JSON.stringify(await box.inputValue()), "(expect 745)");

  const boxes = s.locator(".quiz-answer");
  await boxes.nth(0).fill(""); await boxes.nth(0).type("7");
  await boxes.nth(1).type("1x4");
  await boxes.nth(2).type("9z");
  await s.screenshot({ path: join(SHOTS, "student-quiz.png"), fullPage: true });
  await s.locator("button.hand-in").click();
  await s.waitForSelector(".quiz-results", { timeout: 15000 });
  log("results:", (await s.locator(".quiz-results").innerText()).replace(/\n+/g, " | "));
  await s.screenshot({ path: join(SHOTS, "student-results.png"), fullPage: true });

  log(`\nshots in ${SHOTS}`);
  await b.close();
}

async function shot(path, name = "shot", asStudent = false) {
  const fx = fixture();
  const b = await browser();
  let page;
  if (asStudent) page = await studentQuiz(b, fx);
  else { page = await teacherPage(b); }
  if (!asStudent || path !== "quiz") await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  const out = join(SHOTS, `${name}.png`);
  await page.screenshot({ path: out, fullPage: true });
  log("wrote", out);
  log((await page.locator("body").innerText()).replace(/\n+/g, " | ").slice(0, 400));
  await b.close();
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "seed") await seed();
else if (cmd === "smoke") await smoke();
else if (cmd === "release") await release();
else if (cmd === "shot") await shot(args[0] ?? "/", args[1]);
else if (cmd === "student-shot") await shot(args[0] ?? "quiz", args[1] ?? "student", true);
else {
  log("commands: seed | smoke | release | shot <path> [name] | student-shot <path|quiz> [name]");
  process.exit(1);
}
