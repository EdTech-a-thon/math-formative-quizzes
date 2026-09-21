// Drives Fact Friends in a headless browser. This container has no
// chromium-cli, so Playwright is the handle on the running app.
//
//   node .claude/skills/run-fact-friends/driver.mjs <command>
//
// Commands:
//   seed                       Build a whole fixture: teacher, class, quiz,
//                              progression, student, released attempt.
//                              Writes .claude/skills/run-fact-friends/.fixture.json
//   smoke                      seed, then walk both import paths, sit a quiz,
//                              and run the seven scenarios below.
//   ownership                  A second teacher sees none of the first
//                              teacher's quizzes and cannot open one by id.
//   quiz-lifecycle             Create, edit, export and delete one quiz.
//   student-records            A student's place and attempt history still read.
//   time-limits                Seconds-based time limits, legacy quizzes
//                              included, from the editor through to the clock.
//   cross-class                One quiz in two classes: an edit in one reaches
//                              the other, and sat attempts and places do not move.
//   class-delete               Deleting a class leaves the teacher's quizzes,
//                              and takes its path, students and attempts.
//   send-to-step               Students sent straight to one quiz in a path,
//                              forwards and backwards, and what that must not
//                              disturb.
//   release                    Release another attempt for the seeded student.
//   shot <path> [name]         Screenshot any page signed in as the teacher.
//   student-shot <path|quiz> [name]
//                              Screenshot a page as the seeded student. Pass
//                              "quiz" to land on their released quiz.
//
// Screenshots land in .claude/skills/run-fact-friends/shots/.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
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
  // Wait to leave the setup page itself: matching "/teacher/classes" alone
  // matches the page the click started on, so the id gets read before the class
  // has been created.
  await page.waitForURL((u) => !u.pathname.endsWith("/classes/new"), { timeout: 60000 });
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

// --- Quiz ownership -------------------------------------------------------
//
// A quiz belongs to the teacher, not to a class, so one quiz can be used by the
// learning paths of several of her classes. The regression that buys is one
// teacher's quizzes leaking into another teacher's list: ordinary use never
// shows it, because a teacher only ever signs in as herself. `ownership` signs
// in as a second teacher on purpose and asserts she sees none of the first
// teacher's quizzes and cannot open one by id.

const results = [];
function check(label, pass, detail = "") {
  results.push({ label, pass });
  log(`${pass ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
}

// Signs up a throwaway teacher in her own browser context, the same way `seed`
// does, but without touching the shared fixture files.
async function signUpTeacher(b, name) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } });
  const page = watch(await ctx.newPage(), name);
  const email = `t${Date.now()}x${Math.floor(Math.random() * 10000)}@example.org`;
  await page.goto(`${BASE}/teacher`, { waitUntil: "networkidle" });
  await page.locator(".tabs button", { hasText: "Create account" }).click();
  await page.fill("#name", name);
  await page.fill("#email", email);
  await page.fill("#password", "password12345");
  await page.locator("form button[type=submit]").click();
  await page.waitForURL((u) => !u.pathname.endsWith("/teacher"), { timeout: 20000 });
  return { page, email };
}

// Every class of hers, read off the links on /teacher/home — and "new" is one
// of those links.
async function classIds(page) {
  await page.goto(`${BASE}/teacher/home`, { waitUntil: "networkidle" });
  const hrefs = await page.locator('a[href*="/teacher/classes/"]').evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  return [...new Set(hrefs.map((h) => h.match(/classes\/([^/?]+)/)[1]).filter((id) => id !== "new"))];
}

// Creating a class redirects to /teacher/home, not to the class, so the new
// class is found by which id is new. Position would do for a teacher's first
// class and quietly pick the wrong one for her second.
async function createClass(page, className, starterPath) {
  const before = new Set(await classIds(page));
  await page.goto(`${BASE}/teacher/classes/new`, { waitUntil: "networkidle" });
  await page.fill("#class-name", className);
  // One ready-made path is already ticked when the page opens, so clicking it
  // would turn it off.
  const starter = page.locator(`button.starter-path.op-${starterPath}`);
  if (starterPath && (await starter.getAttribute("aria-pressed")) !== "true") await starter.click();
  await page.locator("button.create-class").click();
  await page.waitForURL((u) => !u.pathname.endsWith("/classes/new"), { timeout: 60000 });
  return (await classIds(page)).find((id) => !before.has(id));
}

async function listedQuizzes(page, classId) {
  await page.goto(`${BASE}/teacher/classes/${classId}/quizzes`, { waitUntil: "networkidle" });
  const hrefs = await page.locator('a[href*="/quizzes/"]').evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  const ids = hrefs.map((h) => h.match(/\/quizzes\/([^/?#]+)/)?.[1]).filter((id) => id && id !== "new");
  return { ids: [...new Set(ids)], text: await page.locator("body").innerText() };
}

async function ownership() {
  const fx = existsSync(FIXTURE) ? fixture() : await seed();
  const b = await browser();
  const hers = await teacherPage(b);

  // 1. The first teacher still sees her own quizzes, in both places she reads
  //    them from: the quizzes page and her learning path.
  const mine = await listedQuizzes(hers, fx.classId);
  check("first teacher sees her own quizzes on the quizzes page", mine.ids.length > 0, `${mine.ids.length} listed`);
  check("her quiz is named in the list", mine.text.includes("Imported sevens drill"));
  await hers.goto(`${BASE}/teacher/classes/${fx.classId}/progressions`, { waitUntil: "networkidle" });
  const pathHref = await hers.locator('a[href*="/progressions/"]').first().getAttribute("href");
  await hers.goto(`${BASE}${pathHref}`, { waitUntil: "networkidle" });
  check("her learning path still lists its quiz", (await hers.locator("body").innerText()).includes("Imported sevens drill"));

  // 2. A second teacher, signed in separately. Her class is built from a
  //    ready-made path, which also proves that route still works.
  const other = await signUpTeacher(b, "Second Teacher");
  const otherClassId = await createClass(other.page, "Second Teacher Class", "multiplication");
  const theirs = await listedQuizzes(other.page, otherClassId);
  check("a class from a ready-made path arrives with its quizzes", theirs.ids.length > 0, `${theirs.ids.length} listed`);

  // 3. The assertion this whole migration turns on.
  const leaked = theirs.ids.filter((id) => mine.ids.includes(id));
  check("second teacher sees none of the first teacher's quizzes", leaked.length === 0, leaked.length ? `leaked ${leaked.join(",")}` : "no overlap");
  check("second teacher's list does not name the first teacher's quiz", !theirs.text.includes("Imported sevens drill"));

  // Both teachers ask for the same quiz id down the same route, so the 404
  // below means the access rule turned it away rather than the id being dead.
  const ownerById = await hers.goto(`${BASE}/teacher/classes/${fx.classId}/quizzes/${mine.ids[0]}`, { waitUntil: "networkidle" });
  check("the quiz opens for the teacher who owns it", ownerById.status() === 200, `status ${ownerById.status()}`);
  const byId = await other.page.goto(`${BASE}/teacher/classes/${otherClassId}/quizzes/${mine.ids[0]}`, { waitUntil: "networkidle" });
  check("second teacher cannot open the first teacher's quiz by id", byId.status() === 404, `status ${byId.status()}`);

  await b.close();
}

// Create, edit, export and delete one quiz, end to end. Importing is covered by
// `smoke` itself.
async function quizLifecycle() {
  const fx = existsSync(FIXTURE) ? fixture() : await seed();
  const b = await browser();
  const page = await teacherPage(b);

  await page.goto(`${BASE}/teacher/classes/${fx.classId}/quizzes/new`, { waitUntil: "networkidle" });
  await page.locator("input.bar-title").fill("Lifecycle quiz");
  // The add control is a big empty-state button until the first question exists.
  await page.locator("button.sheet-empty, li.sheet-add button").first().click();
  await page.waitForTimeout(500);
  const operands = page.locator("input.sheet-operand");
  await operands.nth(0).fill("6");
  await operands.nth(1).fill("7");
  await page.locator("button.editor-save").click();
  await page.waitForURL(/\/quizzes$/, { timeout: 20000 });
  let listed = await listedQuizzes(page, fx.classId);
  check("a new quiz is saved and listed", listed.text.includes("Lifecycle quiz"));

  // Edit it: open the quiz the list just gained and rename it.
  const editHref = await page.locator('a[href*="/quizzes/"]', { hasText: "Lifecycle quiz" }).first().getAttribute("href");
  const quizId = editHref.match(/\/quizzes\/([^/?#]+)/)[1];
  await page.goto(`${BASE}${editHref}`, { waitUntil: "networkidle" });
  await page.locator("input.bar-title").fill("Lifecycle quiz edited");
  await page.locator("button.editor-save").click();
  await page.waitForURL(/\/quizzes$/, { timeout: 20000 });
  listed = await listedQuizzes(page, fx.classId);
  check("editing a quiz saves the new title", listed.text.includes("Lifecycle quiz edited"));

  // Export: the PDF endpoint is what the Export button points at.
  const pdf = await page.request.get(`${BASE}/api/quizzes/${quizId}/pdf`);
  check("exporting a quiz returns a PDF", pdf.ok() && (await pdf.body()).slice(0, 4).toString() === "%PDF", `status ${pdf.status()}`);

  const deleted = await page.request.delete(`${BASE}/api/quizzes/${quizId}`);
  listed = await listedQuizzes(page, fx.classId);
  check("deleting a quiz removes it from the list", deleted.ok() && !listed.text.includes("Lifecycle quiz edited"), `status ${deleted.status()}`);

  await b.close();
}

// A student's place on her path and her finished attempts are the teacher's
// records too, and both are read through the quiz. Neither should have moved.
async function studentRecords() {
  const fx = existsSync(FIXTURE) ? fixture() : await seed();
  const b = await browser();

  const sctx = await b.newContext({ viewport: { width: 1100, height: 900 } });
  const s = watch(await sctx.newPage(), "student");
  await s.goto(`${BASE}/join/${fx.code}`, { waitUntil: "networkidle" });
  await s.locator('input[type="text"], input:not([type])').first().fill(fx.student);
  await s.locator("form button[type=submit]").first().click();
  await s.waitForTimeout(2000);
  const home = await s.locator("body").innerText();
  check("the student still has a place on her path", /step \d+ of \d+/.test(home), home.match(/step \d+ of \d+/)?.[0] ?? "no place shown");
  check("the student still has her finished quizzes", (await s.locator(".history-list a, .history-list > *").count()) > 0);

  // The same attempt, read from the teacher's side.
  const page = await teacherPage(b);
  await page.goto(`${BASE}/teacher/classes/${fx.classId}`, { waitUntil: "networkidle" });
  const studentHref = await page.locator('a[href*="/students/"]').first().getAttribute("href");
  await page.goto(`${BASE}${studentHref}`, { waitUntil: "networkidle" });
  const attemptHref = await page.locator("a.teacher-attempt-row").first().getAttribute("href");
  const review = await page.goto(`${BASE}${attemptHref}`, { waitUntil: "networkidle" });
  check("the teacher can still open a recorded attempt", review.status() === 200 && (await page.locator(".problem-review-list").count()) > 0, `status ${review.status()}`);

  await b.close();
}

// --- Time limits ----------------------------------------------------------
//
// A quiz's time limit is stored in seconds. Quizzes saved before that carry
// whole minutes instead, and two copies of the resolver read the two fields:
// one in the app, one in pb_hooks, because a hook cannot import from $lib. The
// teacher's editor and quiz list read through the app copy; the student's home
// card and countdown read through the hook copy. So a legacy quiz that reads
// one way for the teacher and another for the student is exactly the failure
// these checks are here to catch.

const THREE_QUESTIONS = [
  { id: "t1", op: "multiplication", top: 3, bottom: 4 },
  { id: "t2", op: "multiplication", top: 5, bottom: 6 },
  { id: "t3", op: "multiplication", top: 7, bottom: 8 },
];

// PocketBase's hooks are CommonJS, but this repo is ESM, so node would read
// one of them as a module and choke on `module.exports`. Running the file in a
// wrapper of its own is enough to get at what it exports.
function loadHook(name) {
  const scope = { exports: {} };
  new Function("module", "exports", "require", readFileSync(join(REPO, "pb_hooks", name), "utf8"))(scope, scope.exports, createRequire(import.meta.url));
  return scope.exports;
}

// Both copies of the resolver, over the same table of stored settings. Node
// reads the app's TypeScript directly; the hook copy comes through the wrapper.
async function resolverParity() {
  const app = await import(pathToFileURL(join(REPO, "src/lib/timeLimit.ts")).href);
  const hook = loadHook("time_limit.js");
  const stored = [
    {},
    { timeLimitMinutes: 1 },
    { timeLimitMinutes: 2 },
    { timeLimitMinutes: 0 },
    { timeLimitSeconds: 45 },
    { timeLimitSeconds: 90 },
    { timeLimitSeconds: 300 },
    { timeLimitSeconds: 0, timeLimitMinutes: 2 },
    { timeLimitSeconds: 45, timeLimitMinutes: 3 },
    { timeLimitSeconds: null, timeLimitMinutes: 2 },
    { timeLimitSeconds: "120" },
    { timeLimitSeconds: 9999 },
    { timeLimitMinutes: 999 },
  ];
  const differences = [];
  for (const settings of stored) {
    const mine = app.resolveTimeLimitSeconds(settings);
    const theirs = hook.resolveTimeLimitSeconds(settings);
    const shownByApp = app.timeLimitLabel(mine);
    const shownByHook = hook.timeLimitLabel(theirs);
    log(`  ${JSON.stringify(settings).padEnd(42)} -> ${String(theirs).padStart(4)}s  "${shownByHook}"`);
    if (mine !== theirs || shownByApp !== shownByHook) {
      differences.push(`${JSON.stringify(settings)}: app ${mine} "${shownByApp}" vs hook ${theirs} "${shownByHook}"`);
    }
  }
  check("the app and pb_hooks copies of the resolver agree", differences.length === 0, differences.join("; ") || `${stored.length} stored shapes, same answer both sides`);
}

// A class with no ready-made paths, so the quiz list holds only the quizzes
// this scenario makes. Multiplication is ticked when the page opens.
async function createEmptyClass(page, className) {
  const before = new Set(await classIds(page));
  await page.goto(`${BASE}/teacher/classes/new`, { waitUntil: "networkidle" });
  await page.fill("#class-name", className);
  for (const key of ["addition", "subtraction", "multiplication", "division"]) {
    const path = page.locator(`button.starter-path.op-${key}`);
    if ((await path.getAttribute("aria-pressed")) === "true") await path.click();
  }
  await page.locator("button.create-class").click();
  await page.waitForURL((u) => !u.pathname.endsWith("/classes/new"), { timeout: 60000 });
  return (await classIds(page)).find((id) => !before.has(id));
}

// Saved straight through the app's own route, so a quiz can be stored with
// exactly the settings a scenario needs — including the legacy minutes field
// on its own, which no editor writes any more.
async function makeQuiz(page, title, settings) {
  const response = await page.request.post(`${BASE}/api/quizzes`, {
    data: { data: { title, problems: THREE_QUESTIONS, showScore: true, passMessage: "Great work!", ...settings } },
  });
  if (!response.ok()) throw new Error(`could not save "${title}": ${response.status()} ${await response.text()}`);
  return (await response.json()).id;
}

// One quiz per path by default, so each limit can be sat on its own, but a
// list of quizzes builds a ladder with a step each. Self-paced unless a
// scenario says otherwise, so an attempt is waiting without a release and a
// failed one comes back.
async function makePath(page, classId, name, quiz, extra = {}) {
  const response = await page.request.post(`${BASE}/api/progressions`, {
    data: { class: classId, name, quizIds: Array.isArray(quiz) ? quiz : [quiz], passPercentage: 80, selfPaced: true, ...extra },
  });
  if (!response.ok()) throw new Error(`could not save "${name}": ${response.status()} ${await response.text()}`);
  return (await response.json()).id;
}

async function joinAsStudent(b, code, name) {
  const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } });
  const student = watch(await ctx.newPage(), name);
  await student.goto(`${BASE}/join/${code}`, { waitUntil: "networkidle" });
  await student.locator('input[type="text"], input:not([type])').first().fill(name);
  await student.locator("form button[type=submit]").first().click();
  await student.waitForTimeout(2000);
  return student;
}

async function openEditor(page, classId, quizId) {
  await page.goto(`${BASE}/teacher/classes/${classId}/quizzes/${quizId}`, { waitUntil: "networkidle" });
  return page.locator(".stepper-compact b");
}
async function cardMeta(student, title) {
  await student.goto(`${BASE}/home`, { waitUntil: "networkidle" });
  return (await student.locator("article.assigned-card", { hasText: title }).locator(".assigned-meta").innerText()).trim();
}
// Open the quiz on a card and read what the clock says as it starts. A second
// or two goes by between the page loading and the read, so the check allows it.
async function startingClock(student, title) {
  await student.goto(`${BASE}/home`, { waitUntil: "networkidle" });
  await student.locator("article.assigned-card", { hasText: title }).locator("a.start-quiz").click();
  await student.waitForSelector(".quiz-answer", { timeout: 15000 });
  const clock = student.locator(".quiz-clock");
  return (await clock.count()) ? (await clock.innerText()).trim() : "no clock";
}
const within = (clock, ...allowed) => allowed.includes(clock);

async function timeLimits() {
  log("-- both copies of the resolver, over the same stored settings --");
  await resolverParity();

  const b = await browser();
  const { page } = await signUpTeacher(b, "Timing Teacher");
  const classId = await createEmptyClass(page, "Timing Test Class");

  // Five quizzes, each stored the way a real one would be. "Legacy" carries
  // only the old minutes field, as every quiz did before this change; "Untimed"
  // carries a stored zero with a legacy two minutes still sitting beside it.
  const quiz = {
    legacy: await makeQuiz(page, "Legacy minute drill", { timeLimitMinutes: 1 }),
    short: await makeQuiz(page, "Forty-five second drill", { timeLimitSeconds: 45 }),
    long: await makeQuiz(page, "Ninety second drill", { timeLimitSeconds: 90 }),
    untimed: await makeQuiz(page, "Untimed drill", { timeLimitSeconds: 0, timeLimitMinutes: 2 }),
    stepper: await makeQuiz(page, "Stepper drill", { timeLimitSeconds: 285 }),
  };
  const paths = [];
  for (const [key, title] of [["legacy", "Legacy minute path"], ["short", "Forty-five second path"], ["long", "Ninety second path"], ["untimed", "Untimed path"]]) {
    paths.push(await makePath(page, classId, title, quiz[key]));
  }

  // ---- What the teacher sees ----
  const stepperOf = async (id) => (await (await openEditor(page, classId, id)).innerText()).trim();
  const legacyStepper = await stepperOf(quiz.legacy);
  check("a legacy one-minute quiz reads as 1:00 in the editor", legacyStepper === "1:00", `stepper "${legacyStepper}" (expect 1:00)`);
  const shortStepper = await stepperOf(quiz.short);
  check("a 45-second quiz reads as 45 sec in the editor", shortStepper === "45 sec", `stepper "${shortStepper}" (expect 45 sec)`);
  const longStepper = await stepperOf(quiz.long);
  check("a 90-second quiz reads as 1:30 in the editor", longStepper === "1:30", `stepper "${longStepper}" (expect 1:30)`);
  const untimedStepper = await stepperOf(quiz.untimed);
  check("a stored zero beats the legacy minutes beside it", untimedStepper === "No limit", `stepper "${untimedStepper}" (expect No limit)`);

  // ---- The stepper's own steps ----
  const readings = [];
  const stepper = await openEditor(page, classId, quiz.stepper);
  const less = page.locator('.stepper-compact button[aria-label="Less time"]');
  const more = page.locator('.stepper-compact button[aria-label="More time"]');
  readings.push((await stepper.innerText()).trim());
  for (let press = 0; press < 3; press++) { await more.click(); await page.waitForTimeout(150); readings.push((await stepper.innerText()).trim()); }
  for (let press = 0; press < 3; press++) { await less.click(); await page.waitForTimeout(150); readings.push((await stepper.innerText()).trim()); }
  const expectedSteps = ["4:45", "5:00", "6:00", "7:00", "6:00", "5:00", "4:45"];
  check("the stepper moves in 15-second steps to five minutes, then minutes", readings.join(" ") === expectedSteps.join(" "), `${readings.join(" ")} (expect ${expectedSteps.join(" ")})`);
  await page.screenshot({ path: join(SHOTS, "time-limit-stepper.png") });

  // The bottom of the range: zero is reachable, and it stops there.
  const lowReadings = [];
  const shortEditor = await openEditor(page, classId, quiz.short);
  for (let press = 0; press < 4; press++) { await less.click(); await page.waitForTimeout(150); lowReadings.push((await shortEditor.innerText()).trim()); }
  await more.click();
  await page.waitForTimeout(150);
  lowReadings.push((await shortEditor.innerText()).trim());
  const expectedLow = ["30 sec", "15 sec", "No limit", "No limit", "15 sec"];
  check("the stepper reaches no limit at the bottom and stops there", lowReadings.join(" ") === expectedLow.join(" "), `${lowReadings.join(" ")} (expect ${expectedLow.join(" ")})`);

  // The quiz list and the editor have to agree, so both are read.
  const listed = await listedQuizzes(page, classId);
  check("the quiz list shows 45 sec and 1:30", listed.text.includes("45 sec") && listed.text.includes("1:30"), listed.text.replace(/\n+/g, " | ").slice(0, 220));
  await page.screenshot({ path: join(SHOTS, "time-limit-quiz-list.png"), fullPage: true });

  // ---- Two students: one plain, one with five extra minutes ----
  const code = await teacherClassCode(page, classId);
  const plain = await joinAsStudent(b, code, "Ada Plain");
  const extra = await joinAsStudent(b, code, "Tim Extra");

  await page.goto(`${BASE}/teacher/classes/${classId}`, { waitUntil: "networkidle" });
  const studentId = async (name) => (await page.locator("a.student-detail-link", { hasText: name }).first().getAttribute("href")).match(/\/students\/([^/?#]+)/)[1];
  const plainId = await studentId("Ada Plain");
  const extraId = await studentId("Tim Extra");
  const assigned = await page.request.post(`${BASE}/api/enrollments/bulk`, { data: { students: [plainId, extraId], progressions: paths } });
  if (!assigned.ok()) throw new Error(`could not assign: ${assigned.status()} ${await assigned.text()}`);
  const accommodation = await page.request.patch(`${BASE}/api/students/${extraId}`, { data: { extraTimeMinutes: 5 } });
  if (!accommodation.ok()) throw new Error(`could not give extra time: ${accommodation.status()} ${await accommodation.text()}`);

  // ---- What a student sees ----
  const legacyCard = await cardMeta(plain, "Legacy minute drill");
  check("a legacy quiz's card shows 1:00", legacyCard.endsWith("· 1:00"), `"${legacyCard}" (expect 3 questions · 1:00)`);
  const shortCard = await cardMeta(plain, "Forty-five second drill");
  check("a 45-second quiz's card shows 45 sec", shortCard.endsWith("· 45 sec"), `"${shortCard}" (expect 3 questions · 45 sec)`);
  const longCard = await cardMeta(plain, "Ninety second drill");
  check("a 90-second quiz's card shows 1:30", longCard.endsWith("· 1:30"), `"${longCard}" (expect 3 questions · 1:30)`);
  const untimedCard = await cardMeta(plain, "Untimed drill");
  check("an untimed quiz's card shows no time at all", untimedCard === "3 questions", `"${untimedCard}" (expect 3 questions)`);
  await plain.screenshot({ path: join(SHOTS, "time-limit-student-home.png"), fullPage: true });

  const legacyClock = await startingClock(plain, "Legacy minute drill");
  check("a legacy quiz counts down from 1:00", within(legacyClock, "1:00", "0:59"), `clock "${legacyClock}" (expect 1:00)`);
  const longClock = await startingClock(plain, "Ninety second drill");
  check("a 90-second quiz counts down from 1:30", within(longClock, "1:30", "1:29"), `clock "${longClock}" (expect 1:30)`);
  const untimedClock = await startingClock(plain, "Untimed drill");
  check("an untimed quiz shows no countdown", untimedClock === "no clock", `clock "${untimedClock}" (expect no clock)`);

  // ---- Extra time, which is still set in whole minutes ----
  const extraCard = await cardMeta(extra, "Forty-five second drill");
  check("extra time is on the card the student starts from", extraCard.endsWith("· 5:45"), `"${extraCard}" (expect 3 questions · 5:45)`);
  const extraClock = await startingClock(extra, "Forty-five second drill");
  check("extra time is on the clock too", within(extraClock, "5:45", "5:44"), `clock "${extraClock}" (expect 5:45)`);
  await extra.screenshot({ path: join(SHOTS, "time-limit-extra-time.png"), fullPage: true });
  const extraUntimed = await startingClock(extra, "Untimed drill");
  check("an untimed quiz stays untimed for a student with extra time", extraUntimed === "no clock", `clock "${extraUntimed}" (expect no clock)`);
  await extra.screenshot({ path: join(SHOTS, "time-limit-untimed.png"), fullPage: true });

  // ---- Saving a legacy quiz leaves the limit where it was ----
  await openEditor(page, classId, quiz.legacy);
  await page.locator("button.editor-save").click();
  await page.waitForURL(/\/quizzes$/, { timeout: 20000 });
  const savedStepper = await stepperOf(quiz.legacy);
  check("saving a legacy quiz converts it without changing its limit", savedStepper === "1:00", `stepper "${savedStepper}" (expect 1:00)`);
  const savedCard = await cardMeta(plain, "Legacy minute drill");
  check("and the student still gets the same 1:00", savedCard.endsWith("· 1:00"), `"${savedCard}" (expect 3 questions · 1:00)`);

  // ---- The short quiz hands itself in when the clock runs out ----
  const runOut = await startingClock(plain, "Forty-five second drill");
  check("a 45-second quiz counts down from 0:45", within(runOut, "0:45", "0:44"), `clock "${runOut}" (expect 0:45)`);
  await plain.screenshot({ path: join(SHOTS, "time-limit-45-seconds.png"), fullPage: true });
  let handedItself = true;
  await plain.waitForSelector(".quiz-results", { timeout: 75000 }).catch(() => { handedItself = false; });
  check("it hands itself in when the clock reaches zero", handedItself, handedItself ? "results came up on their own" : "no results after 75s");
  await plain.screenshot({ path: join(SHOTS, "time-limit-timed-out.png"), fullPage: true });

  log(`\nshots in ${SHOTS}`);
  await b.close();
}

// --- One quiz, two classes ------------------------------------------------
//
// The complaint the whole change comes from: "I edited the Multiply by 6 test
// for one class, but when I click on a different class it shows the test you
// created." A quiz is the teacher's now, so one quiz record can sit in the
// learning paths of two of her classes and an edit reaches both. The half that
// ordinary use hides is what must *not* move with it: an attempt a student
// already sat keeps the questions she was sat with, and her place stays put.

// One quiz's card on the quizzes page: where it says it is used, and the link
// that opens it.
async function quizCard(page, classId, title) {
  await page.goto(`${BASE}/teacher/classes/${classId}/quizzes`, { waitUntil: "networkidle" });
  const card = page.locator(".library-card", { hasText: title }).first();
  return {
    tags: (await card.locator(".card-memberships").innerText()).replace(/\s*\n+\s*/g, " | ").trim(),
    href: await card.getAttribute("href"),
  };
}

// The student's place on her path, in her own words on her home page.
async function studentPlace(student) {
  await student.goto(`${BASE}/home`, { waitUntil: "networkidle" });
  return (await student.locator("body").innerText()).match(/step \d+ of \d+/)?.[0] ?? "no place shown";
}

async function crossClass() {
  const b = await browser();
  const { page } = await signUpTeacher(b, "Sharing Teacher");
  const period1 = await createEmptyClass(page, "Period 1 Sharing");
  const period2 = await createEmptyClass(page, "Period 2 Sharing");

  // One quiz, used by a learning path in each class. Untimed, so no clock can
  // hand a student's attempt in mid-run; answers shown, so she can open her
  // finished attempt again afterwards.
  const shared = await makeQuiz(page, "Multiply by 6", { timeLimitSeconds: 0 });
  const path1 = await makePath(page, period1, "Period 1 sixes", shared, { showAnswers: true });
  const path2 = await makePath(page, period2, "Period 2 sixes", shared, { showAnswers: true });

  // A quiz built in the editor while standing in Period 1, which no path uses.
  await page.goto(`${BASE}/teacher/classes/${period1}/quizzes/new`, { waitUntil: "networkidle" });
  await page.locator("input.bar-title").fill("Spare sevens drill");
  await page.locator("button.sheet-empty, li.sheet-add button").first().click();
  await page.waitForTimeout(500);
  await page.locator("input.sheet-operand").nth(0).fill("7");
  await page.locator("input.sheet-operand").nth(1).fill("3");
  await page.locator("button.editor-save").click();
  await page.waitForURL(/\/quizzes$/, { timeout: 20000 });

  // A student in Period 1 sits the shared quiz *before* it is edited. Two of
  // three right is under the 80% pass mark, so she stays on the step she is on.
  const code = await teacherClassCode(page, period1);
  const ada = await joinAsStudent(b, code, "Ada Sharing");
  await page.goto(`${BASE}/teacher/classes/${period1}`, { waitUntil: "networkidle" });
  const adaId = (await page.locator("a.student-detail-link", { hasText: "Ada Sharing" }).first().getAttribute("href")).match(/\/students\/([^/?#]+)/)[1];
  const assigned = await page.request.post(`${BASE}/api/enrollments/bulk`, { data: { students: [adaId], progressions: [path1] } });
  if (!assigned.ok()) throw new Error(`could not assign: ${assigned.status()} ${await assigned.text()}`);

  await ada.goto(`${BASE}/home`, { waitUntil: "networkidle" });
  await ada.locator("article.assigned-card", { hasText: "Multiply by 6" }).locator("a.start-quiz").click();
  await ada.waitForSelector(".quiz-answer", { timeout: 15000 });
  const boxes = ada.locator(".quiz-answer");
  const given = ["999", "30", "56"]; // 3 × 4 wrong on purpose, 5 × 6 and 7 × 8 right
  for (let index = 0; index < given.length; index++) await boxes.nth(index).fill(given[index]);
  await ada.locator("button.hand-in").click();
  await ada.waitForSelector(".quiz-results", { timeout: 15000 });
  const placeBefore = await studentPlace(ada);

  // ---- What the quizzes page says, standing in the *other* class ----
  const sharedCard = await quizCard(page, period2, "Multiply by 6");
  check("a quiz used by another class's path is listed here too", Boolean(sharedCard.href), sharedCard.href ?? "no card");
  const named = ["Period 1 sixes", "Period 1 Sharing", "Period 2 sixes", "Period 2 Sharing"];
  check("its tags name both paths and both classes using it", named.every((text) => sharedCard.tags.includes(text)), sharedCard.tags);
  const spareCard = await quizCard(page, period2, "Spare sevens drill");
  check("a quiz no path uses is still listed", spareCard.tags.includes("Not in a progression"), spareCard.tags);
  await page.screenshot({ path: join(SHOTS, "shared-quiz-list.png"), fullPage: true });

  // ---- What the editor says before anything is edited ----
  await page.goto(`${BASE}/teacher/classes/${period1}/quizzes/${shared}`, { waitUntil: "networkidle" });
  const reach = (await page.locator(".bar-reach").innerText()).trim();
  check("the editor says how far an edit reaches before it is made", reach.startsWith("Used in 2 classes"), `"${reach}" (expect Used in 2 classes…)`);
  await page.screenshot({ path: join(SHOTS, "shared-quiz-reach.png") });
  const spareId = spareCard.href.match(/\/quizzes\/([^/?#]+)/)[1];
  await page.goto(`${BASE}/teacher/classes/${period1}/quizzes/${spareId}`, { waitUntil: "networkidle" });
  const spareReach = (await page.locator(".bar-reach").innerText()).trim();
  check("a quiz no class uses says so in its editor", spareReach === "Not used by a class yet", `"${spareReach}"`);

  // ---- The edit, made from Period 1 ----
  await page.goto(`${BASE}/teacher/classes/${period1}/quizzes/${shared}`, { waitUntil: "networkidle" });
  await page.locator("input.bar-title").fill("Sixes fixed in Period 1");
  await page.locator("input.sheet-operand").nth(0).fill("6");
  await page.locator("input.sheet-operand").nth(1).fill("6");
  await page.locator("button.editor-save").click();
  await page.waitForURL(/\/quizzes$/, { timeout: 20000 });

  // ---- The payoff: Period 2 has the edit, without being touched ----
  const otherPath = await page.goto(`${BASE}/teacher/classes/${period2}/progressions/${path2}`, { waitUntil: "networkidle" });
  const otherPathText = (await page.locator(".progression-step-list").innerText()).replace(/\s*\n+\s*/g, " | ");
  check("the other class's path opens", otherPath.status() === 200, `status ${otherPath.status()}`);
  check("the other class's path shows the edited quiz", otherPathText.includes("Sixes fixed in Period 1"), otherPathText.slice(0, 160));
  check("and no longer shows the version she started with", !otherPathText.includes("Multiply by 6"), otherPathText.slice(0, 160));
  await page.screenshot({ path: join(SHOTS, "shared-quiz-other-class.png"), fullPage: true });
  const editedCard = await quizCard(page, period2, "Sixes fixed in Period 1");
  check("and the quizzes page in that class agrees", editedCard.tags.includes("Period 2 sixes"), editedCard.tags);

  // ---- What the edit must not reach ----
  await page.goto(`${BASE}/teacher/classes/${period1}/students/${adaId}`, { waitUntil: "networkidle" });
  const attemptHref = await page.locator("a.teacher-attempt-row").first().getAttribute("href");
  await page.goto(`${BASE}${attemptHref}`, { waitUntil: "networkidle" });
  const reviewed = (await page.locator(".problem-review-list").innerText()).replace(/\s+/g, " ");
  check("the recorded attempt still shows the questions she was given", reviewed.includes("3 × 4") && !reviewed.includes("6 × 6"), reviewed.slice(0, 140));

  await ada.goto(`${BASE}/home`, { waitUntil: "networkidle" });
  await ada.locator(".history-list a").first().click();
  await ada.waitForSelector(".student-answer-list", { timeout: 15000 });
  const herReview = (await ada.locator(".student-answer-list").innerText()).replace(/\s+/g, " ");
  check("and the student reviewing it sees her original questions", herReview.includes("3 × 4") && !herReview.includes("6 × 6"), herReview.slice(0, 140));
  await ada.screenshot({ path: join(SHOTS, "shared-quiz-student-review.png"), fullPage: true });
  const placeAfter = await studentPlace(ada);
  check("her place on her path has not moved", placeAfter === placeBefore && placeAfter !== "no place shown", `${placeBefore} -> ${placeAfter}`);

  // ---- A path in one class adding a quiz built in the other ----
  await page.goto(`${BASE}/teacher/classes/${period2}/progressions/new`, { waitUntil: "networkidle" });
  const offered = await page.getByRole("button", { name: /Spare sevens drill/ }).count();
  check("a new path is offered a quiz built in another class", offered > 0, `${offered} offered`);
  await page.locator('input[placeholder="Untitled path"]').fill("Period 2 spares");
  await page.getByRole("button", { name: /Spare sevens drill/ }).first().click();
  await page.getByRole("button", { name: "Save progression" }).click();
  await page.waitForTimeout(2500);
  const spareNow = await quizCard(page, period2, "Spare sevens drill");
  check("and adding it tags the quiz with that class and path", spareNow.tags.includes("Period 2 spares") && spareNow.tags.includes("Period 2 Sharing"), spareNow.tags);

  log(`\nshots in ${SHOTS}`);
  await b.close();
}

// --- Deleting a class -----------------------------------------------------
//
// Deleting a class used to take its quizzes with it, because they belonged to
// the class. They are the teacher's now, so the class's path, students and
// attempts go and her quizzes stay — including one she renamed, which she must
// still be able to open, edit, and add to a path in the class she kept.

async function classDelete() {
  const b = await browser();
  const { page } = await signUpTeacher(b, "Tidying Teacher");
  const gone = await createClass(page, "Autumn Period 1", "multiplication");
  const kept = await createClass(page, "Autumn Period 2", "multiplication");

  // The first quiz on the doomed class's ready-made path, renamed so it can be
  // told apart from the other class's own copy of it.
  await page.goto(`${BASE}/teacher/classes/${gone}/progressions`, { waitUntil: "networkidle" });
  const pathId = (await page.locator("a.progression-card-link").first().getAttribute("href")).match(/\/progressions\/([^/?#]+)/)[1];
  await page.goto(`${BASE}/teacher/classes/${gone}/progressions/${pathId}`, { waitUntil: "networkidle" });
  const quizId = (await page.locator("a.step-quiz-link").first().getAttribute("href")).match(/\/quizzes\/([^/?#]+)/)[1];
  await page.goto(`${BASE}/teacher/classes/${gone}/quizzes/${quizId}`, { waitUntil: "networkidle" });
  await page.locator("input.bar-title").fill("Renamed before the class went");
  await page.locator("button.editor-save").click();
  await page.waitForURL(/\/quizzes$/, { timeout: 20000 });

  // A student in the doomed class, who sits the renamed quiz. A ready-made
  // path waits for the teacher, so the attempt has to be released.
  const code = await teacherClassCode(page, gone);
  const sam = await joinAsStudent(b, code, "Sam Leaving");
  await page.goto(`${BASE}/teacher/classes/${gone}`, { waitUntil: "networkidle" });
  const samId = (await page.locator("a.student-detail-link", { hasText: "Sam Leaving" }).first().getAttribute("href")).match(/\/students\/([^/?#]+)/)[1];
  const assigned = await page.request.post(`${BASE}/api/enrollments/bulk`, { data: { students: [samId], progressions: [pathId] } });
  if (!assigned.ok()) throw new Error(`could not assign: ${assigned.status()} ${await assigned.text()}`);
  await page.goto(`${BASE}/teacher/classes/${gone}/progressions`, { waitUntil: "networkidle" });
  const releaseButton = page.getByRole("button", { name: /Release \d+/ });
  if (await releaseButton.count()) { await releaseButton.first().click(); await page.waitForTimeout(2500); }

  await sam.goto(`${BASE}/home`, { waitUntil: "networkidle" });
  await sam.locator("a.start-quiz").first().click();
  await sam.waitForSelector(".quiz-answer", { timeout: 15000 });
  const boxes = sam.locator(".quiz-answer");
  const boxCount = await boxes.count();
  for (let index = 0; index < boxCount; index++) await boxes.nth(index).fill("4");
  await sam.locator("button.hand-in").click();
  await sam.waitForSelector(".quiz-results", { timeout: 20000 });

  // ---- Delete the class ----
  const removed = await page.request.delete(`${BASE}/api/classes/${gone}`);
  check("the class is deleted", removed.ok(), `status ${removed.status()}`);

  const ids = await classIds(page);
  const home = (await page.locator("body").innerText()).replace(/\s*\n+\s*/g, " | ");
  check("the deleted class is gone from the home page", !ids.includes(gone) && !home.includes("Autumn Period 1"), home.slice(0, 160));
  check("the class she kept is still there", ids.includes(kept) && home.includes("Autumn Period 2"), home.slice(0, 160));
  const deadPath = await page.goto(`${BASE}/teacher/classes/${gone}/progressions/${pathId}`, { waitUntil: "networkidle" });
  check("the deleted class's path is gone with it", deadPath.status() === 404, `status ${deadPath.status()}`);
  const keptQuizzes = await page.goto(`${BASE}/teacher/classes/${kept}/quizzes`, { waitUntil: "networkidle" });
  check("the class she kept still opens", keptQuizzes.status() === 200, `status ${keptQuizzes.status()}`);

  // ---- The quiz outlives the class ----
  const survivor = await page.goto(`${BASE}/teacher/classes/${kept}/quizzes/${quizId}`, { waitUntil: "networkidle" });
  check("a quiz from the deleted class survives it", survivor.status() === 200, `status ${survivor.status()}`);
  const survivorTitle = await page.locator("input.bar-title").inputValue();
  check("and still carries the rename she gave it", survivorTitle === "Renamed before the class went", `"${survivorTitle}"`);
  await page.locator("input.bar-title").fill("Renamed again afterwards");
  await page.locator("button.editor-save").click();
  await page.waitForURL(/\/quizzes$/, { timeout: 20000 });
  await page.goto(`${BASE}/teacher/classes/${kept}/quizzes/${quizId}`, { waitUntil: "networkidle" });
  check("and is still editable", (await page.locator("input.bar-title").inputValue()) === "Renamed again afterwards", "renamed a second time");

  // ---- And can be put to work in the class that is left ----
  await page.goto(`${BASE}/teacher/classes/${kept}/progressions/new`, { waitUntil: "networkidle" });
  await page.locator('input[placeholder="Untitled path"]').fill("Autumn rescue path");
  await page.getByRole("button", { name: /Renamed again afterwards/ }).first().click();
  await page.getByRole("button", { name: "Save progression" }).click();
  await page.waitForTimeout(2500);
  const rescued = await quizCard(page, kept, "Renamed again afterwards");
  check("and can be added to a path in the class she kept", rescued.tags.includes("Autumn rescue path"), rescued.tags);
  await page.screenshot({ path: join(SHOTS, "class-delete-survivor.png"), fullPage: true });

  log(`\nshots in ${SHOTS}`);
  await b.close();
}

// --- Sending students to a step -------------------------------------------
//
// A teacher already past multiplying by 5 could not give her class "Multiply by
// 6": assigning a learning path always started a student at its first quiz.
// Sending students to a step is one action covering three cases — a student who
// was never on the path, one partway along it, and one who had finished it —
// and it grants the release itself, so nothing waits on a second button. What
// it must never do is invent history: the steps a student is sent past were
// never sat, and nothing she really did is taken away.

// One step of the path on screen, found by the quiz sitting on it.
const stepFor = (page, quizTitle) => page.locator(".progression-step-detail", { hasText: quizTitle });

// Fill every answer with the right number, read off the card. Every quiz this
// driver builds is multiplication, so the two numbers on the card are all it
// takes to pass one.
async function answerCorrectly(student) {
  const problems = student.locator(".quiz-problem");
  const count = await problems.count();
  for (let index = 0; index < count; index++) {
    const numbers = (await problems.nth(index).locator(".quiz-stack").innerText()).match(/\d+/g).map(Number);
    await problems.nth(index).locator(".quiz-answer").fill(String(numbers[0] * numbers[1]));
  }
}

// Sit a quiz from the student's home screen and hand it in. A wrong answer in
// every box is still an attempt, and still lands in her history.
async function sitQuiz(student, title, passing) {
  await student.goto(`${BASE}/home`, { waitUntil: "networkidle" });
  await student.locator("article.assigned-card", { hasText: title }).locator("a.start-quiz").click();
  await student.waitForSelector(".quiz-answer", { timeout: 15000 });
  if (passing) await answerCorrectly(student);
  else {
    const boxes = student.locator(".quiz-answer");
    const count = await boxes.count();
    for (let index = 0; index < count; index++) await boxes.nth(index).fill("1");
  }
  await student.locator("button.hand-in").click();
  await student.waitForSelector(".quiz-results", { timeout: 20000 });
}

async function studentId(page, classId, name) {
  await page.goto(`${BASE}/teacher/classes/${classId}`, { waitUntil: "networkidle" });
  const href = await page.locator("a.student-detail-link", { hasText: name }).first().getAttribute("href");
  return href.match(/\/students\/([^/?#]+)/)[1];
}

// What the student's home screen offers her, and whether she can start it
// without the teacher releasing anything afterwards.
async function offered(student, title) {
  await student.goto(`${BASE}/home`, { waitUntil: "networkidle" });
  const card = student.locator("article.assigned-card", { hasText: title });
  if (!(await card.count())) return { onScreen: false, canStart: false };
  const start = card.locator("a.start-quiz");
  if (!(await start.count())) return { onScreen: true, canStart: false };
  await start.click();
  await student.waitForSelector(".quiz-answer", { timeout: 15000 });
  return { onScreen: true, canStart: true };
}

async function openSendDialog(page, classId, pathId, quizTitle) {
  await page.goto(`${BASE}/teacher/classes/${classId}/progressions/${pathId}`, { waitUntil: "networkidle" });
  await stepFor(page, quizTitle).locator("button.step-send-button").click();
  await page.waitForSelector(".assign-dialog");
}

// Tick the named students and confirm. The confirm button carries the count, so
// a bare "Send" never matches it.
async function confirmSend(page, names) {
  for (const name of names) await page.locator(".assign-dialog-row", { hasText: name }).locator("input[type=checkbox]").check();
  const confirm = page.locator(".assign-dialog footer button.primary-action");
  const label = (await confirm.innerText()).trim();
  await confirm.click();
  await page.waitForSelector(".assign-dialog", { state: "detached", timeout: 20000 });
  await page.waitForTimeout(500);
  return label;
}

// Every quiz title in a student's attempt history, as the teacher sees it.
async function attemptTitles(page, classId, id) {
  await page.goto(`${BASE}/teacher/classes/${classId}/students/${id}`, { waitUntil: "networkidle" });
  return page.locator(".teacher-attempt-row .attempt-quiz strong").allInnerTexts();
}

async function sendToStep() {
  const b = await browser();
  const { page } = await signUpTeacher(b, "Sending Teacher");
  const classId = await createEmptyClass(page, "Multiplication Period 3");
  const code = await teacherClassCode(page, classId);

  // A four-quiz ladder, teacher released on purpose: on a self-paced path every
  // student is ready anyway, so "moving also lets them start" would prove
  // nothing.
  const ladder = [];
  for (const title of ["Multiply by 3", "Multiply by 4", "Multiply by 5", "Multiply by 6"]) ladder.push(await makeQuiz(page, title, {}));
  const pathId = await makePath(page, classId, "Times tables ladder", ladder, { selfPaced: false });

  const ada = await joinAsStudent(b, code, "Ada Ahead");
  const bo = await joinAsStudent(b, code, "Bo Behind");
  const cy = await joinAsStudent(b, code, "Cy Catchup");
  const adaId = await studentId(page, classId, "Ada Ahead");

  // Only Ada is on the path, at its first quiz, the way assigning has always
  // worked. Bo and Cy are in the class and nowhere near it.
  const assigned = await page.request.post(`${BASE}/api/enrollments/bulk`, { data: { students: [adaId], progressions: [pathId] } });
  if (!assigned.ok()) throw new Error(`could not assign: ${assigned.status()} ${await assigned.text()}`);

  // ---- Three students, two of them new to the path, sent to the third quiz --
  await openSendDialog(page, classId, pathId, "Multiply by 5");
  await page.fill(".assign-dialog-search input", "Bo");
  await page.waitForTimeout(300);
  const filtered = await page.locator(".assign-dialog-row").count();
  await page.locator(".assign-dialog-toolbar button").click();
  const afterSelectAll = (await page.locator(".assign-dialog-toolbar span").innerText()).trim();
  check("the picker's search narrows the list and select-all takes only those", filtered === 1 && afterSelectAll === "1 selected", `${filtered} shown, ${afterSelectAll}`);
  await page.fill(".assign-dialog-search input", "");
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(SHOTS, "send-to-step-picker.png") });
  const label = await confirmSend(page, ["Ada Ahead", "Bo Behind", "Cy Catchup"]);
  check("the picker's confirm button says send, not assign", /^Send 3 students$/.test(label), `"${label}"`);

  const told = (await page.locator(".message.success").innerText()).trim();
  check("the teacher is told how many students moved", /Moved 3 students to Multiply by 5/.test(told), `"${told}"`);

  const atStep = stepFor(page, "Multiply by 5");
  const names = (await atStep.locator(".step-student-link strong").allInnerTexts()).map((name) => name.trim()).sort();
  check("all three sit at the quiz they were sent to", JSON.stringify(names) === JSON.stringify(["Ada Ahead", "Bo Behind", "Cy Catchup"]), names.join(", "));
  const ready = await atStep.locator(".release-status.ready").count();
  check("and all three read as ready, with no release pressed", ready === 3, `${ready} ready`);
  const stepCount = (await atStep.locator(".step-header-side > span").innerText()).trim();
  check("the path view counts the students sitting at that step", stepCount === "3 students", `"${stepCount}"`);
  await page.screenshot({ path: join(SHOTS, "send-to-step-path.png"), fullPage: true });

  // ---- Each of them can start it, with nothing released afterwards ---------
  for (const [student, name] of [[ada, "Ada Ahead"], [bo, "Bo Behind"], [cy, "Cy Catchup"]]) {
    const seen = await offered(student, "Multiply by 5");
    check(`${name}'s home screen offers the quiz and starts it with no separate release`, seen.onScreen && seen.canStart, JSON.stringify(seen));
  }
  await ada.goto(`${BASE}/home`, { waitUntil: "networkidle" });
  await ada.screenshot({ path: join(SHOTS, "send-to-step-student-home.png"), fullPage: true });

  // ---- The steps they were sent past were never sat ------------------------
  let skipped = [];
  for (const name of ["Ada Ahead", "Bo Behind", "Cy Catchup"]) {
    skipped = skipped.concat(await attemptTitles(page, classId, await studentId(page, classId, name)));
  }
  check("no attempt records exist for the steps they skipped", skipped.length === 0, skipped.join(", ") || "no attempts at all");

  // ---- Moving backwards keeps everything she really did --------------------
  await sitQuiz(ada, "Multiply by 5", false);
  await openSendDialog(page, classId, pathId, "Multiply by 4");
  await confirmSend(page, ["Ada Ahead"]);
  const backAt = (await stepFor(page, "Multiply by 4").locator(".step-student-link strong").allInnerTexts()).map((name) => name.trim());
  check("a student can be moved backwards to an earlier quiz", backAt.includes("Ada Ahead"), backAt.join(", ") || "nobody");
  const kept = await attemptTitles(page, classId, adaId);
  check("the move keeps her earlier attempt in her history", kept.includes("Multiply by 5"), kept.join(", ") || "no attempts");
  const again = await offered(ada, "Multiply by 4");
  check("and the earlier quiz is offered to her again", again.onScreen && again.canStart, JSON.stringify(again));
  await ada.goto(`${BASE}/home`, { waitUntil: "networkidle" });
  const history = await ada.locator(".history-row .history-name strong").allInnerTexts();
  check("her own history still shows the quiz she sat", history.includes("Multiply by 5"), history.join(", ") || "empty");

  // ---- A student who had finished the path, pulled back ---------------------
  const warmUp = await makeQuiz(page, "Doubling warm up", {});
  const sprint = await makeQuiz(page, "Doubling sprint", {});
  const doubles = await makePath(page, classId, "Doubles", [warmUp, sprint], { passPercentage: 50 });
  const dee = await joinAsStudent(b, code, "Dee Done");
  const deeId = await studentId(page, classId, "Dee Done");
  const onDoubles = await page.request.post(`${BASE}/api/enrollments/bulk`, { data: { students: [deeId], progressions: [doubles] } });
  if (!onDoubles.ok()) throw new Error(`could not assign: ${onDoubles.status()} ${await onDoubles.text()}`);
  await sitQuiz(dee, "Doubling warm up", true);
  await sitQuiz(dee, "Doubling sprint", true);

  await page.goto(`${BASE}/teacher/classes/${classId}/progressions/${doubles}`, { waitUntil: "networkidle" });
  const finished = await page.locator(".progression-completed").innerText().catch(() => "");
  check("she finishes the path", finished.includes("Dee Done"), finished.replace(/\n+/g, " | ") || "not listed as completed");

  await openSendDialog(page, classId, doubles, "Doubling warm up");
  await confirmSend(page, ["Dee Done"]);
  const stillCompleted = await page.locator(".progression-completed", { hasText: "Dee Done" }).count();
  const pulledBack = (await stepFor(page, "Doubling warm up").locator(".step-student-link strong").allInnerTexts()).map((name) => name.trim());
  check("pulling her back to a step makes her active again", stillCompleted === 0 && pulledBack.includes("Dee Done"), `completed: ${stillCompleted}, at the step: ${pulledBack.join(", ") || "nobody"}`);
  const deeOffered = await offered(dee, "Doubling warm up");
  check("and the quiz is offered to her", deeOffered.onScreen && deeOffered.canStart, JSON.stringify(deeOffered));
  await page.screenshot({ path: join(SHOTS, "send-to-step-completed.png"), fullPage: true });

  log(`\nshots in ${SHOTS}`);
  await b.close();
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

  // Every box needs a digit or Hand in stays disabled, and the released quiz is
  // not always the three-question one the driver imported — a class is set up
  // with a ready-made path by default.
  const boxes = s.locator(".quiz-answer");
  const boxCount = await boxes.count();
  await boxes.nth(0).fill(""); await boxes.nth(0).type("7");
  if (boxCount > 1) await boxes.nth(1).type("1x4");
  if (boxCount > 2) await boxes.nth(2).type("9z");
  for (let i = 3; i < boxCount; i++) await boxes.nth(i).fill("0");
  await s.screenshot({ path: join(SHOTS, "student-quiz.png"), fullPage: true });
  await s.locator("button.hand-in").click();
  await s.waitForSelector(".quiz-results", { timeout: 15000 });
  log("results:", (await s.locator(".quiz-results").innerText()).replace(/\n+/g, " | "));
  await s.screenshot({ path: join(SHOTS, "student-results.png"), fullPage: true });

  log(`\nshots in ${SHOTS}`);
  await b.close();

  // Quizzes belong to the teacher, so these three scenarios assert what a
  // second teacher cannot see, and that nothing a teacher or student already
  // had has moved.
  log("\n-- quiz ownership --");
  await ownership();
  log("\n-- quiz lifecycle --");
  await quizLifecycle();
  log("\n-- student records --");
  await studentRecords();
  log("\n-- time limits --");
  await timeLimits();
  log("\n-- one quiz, two classes --");
  await crossClass();
  log("\n-- deleting a class --");
  await classDelete();
  log("\n-- sending students to a step --");
  await sendToStep();
  summarise();
}

function summarise() {
  const failed = results.filter((result) => !result.pass);
  log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    for (const result of failed) log(`  FAILED: ${result.label}`);
    process.exitCode = 1;
  }
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
else if (cmd === "ownership") { await ownership(); summarise(); }
else if (cmd === "quiz-lifecycle") { await quizLifecycle(); summarise(); }
else if (cmd === "student-records") { await studentRecords(); summarise(); }
else if (cmd === "time-limits") { await timeLimits(); summarise(); }
else if (cmd === "cross-class") { await crossClass(); summarise(); }
else if (cmd === "class-delete") { await classDelete(); summarise(); }
else if (cmd === "send-to-step") { await sendToStep(); summarise(); }
else if (cmd === "release") await release();
else if (cmd === "shot") await shot(args[0] ?? "/", args[1]);
else if (cmd === "student-shot") await shot(args[0] ?? "quiz", args[1] ?? "student", true);
else {
  log("commands: seed | smoke | ownership | quiz-lifecycle | student-records | time-limits | cross-class | class-delete | send-to-step | release | shot <path> [name] | student-shot <path|quiz> [name]");
  process.exit(1);
}
