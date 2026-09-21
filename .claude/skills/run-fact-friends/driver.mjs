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
//                              and run the four scenarios below.
//   ownership                  A second teacher sees none of the first
//                              teacher's quizzes and cannot open one by id.
//   quiz-lifecycle             Create, edit, export and delete one quiz.
//   student-records            A student's place and attempt history still read.
//   time-limits                Seconds-based time limits, legacy quizzes
//                              included, from the editor through to the clock.
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

// Creating a class redirects to /teacher/home, so the id is read off the class
// links there — and "new" is one of those links.
async function createClass(page, className, starterPath) {
  await page.goto(`${BASE}/teacher/classes/new`, { waitUntil: "networkidle" });
  await page.fill("#class-name", className);
  // One ready-made path is already ticked when the page opens, so clicking it
  // would turn it off.
  const starter = page.locator(`button.starter-path.op-${starterPath}`);
  if (starterPath && (await starter.getAttribute("aria-pressed")) !== "true") await starter.click();
  await page.locator("button.create-class").click();
  await page.waitForURL((u) => !u.pathname.endsWith("/classes/new"), { timeout: 60000 });
  await page.goto(`${BASE}/teacher/home`, { waitUntil: "networkidle" });
  const hrefs = await page.locator('a[href*="/teacher/classes/"]').evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  const ids = hrefs.map((h) => h.match(/classes\/([^/?]+)/)[1]).filter((id) => id !== "new");
  return ids[ids.length - 1];
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
  await page.goto(`${BASE}/teacher/classes/new`, { waitUntil: "networkidle" });
  await page.fill("#class-name", className);
  for (const key of ["addition", "subtraction", "multiplication", "division"]) {
    const path = page.locator(`button.starter-path.op-${key}`);
    if ((await path.getAttribute("aria-pressed")) === "true") await path.click();
  }
  await page.locator("button.create-class").click();
  await page.waitForURL((u) => !u.pathname.endsWith("/classes/new"), { timeout: 60000 });
  await page.goto(`${BASE}/teacher/home`, { waitUntil: "networkidle" });
  const hrefs = await page.locator('a[href*="/teacher/classes/"]').evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  const ids = hrefs.map((h) => h.match(/classes\/([^/?]+)/)[1]).filter((id) => id !== "new");
  return ids[ids.length - 1];
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

// One quiz per path, so each limit can be sat on its own. Self-paced, so an
// attempt is waiting without a release and a failed one comes back.
async function makePath(page, classId, name, quizId) {
  const response = await page.request.post(`${BASE}/api/progressions`, {
    data: { class: classId, name, quizIds: [quizId], passPercentage: 80, selfPaced: true },
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
else if (cmd === "release") await release();
else if (cmd === "shot") await shot(args[0] ?? "/", args[1]);
else if (cmd === "student-shot") await shot(args[0] ?? "quiz", args[1] ?? "student", true);
else {
  log("commands: seed | smoke | ownership | quiz-lifecycle | student-records | time-limits | release | shot <path> [name] | student-shot <path|quiz> [name]");
  process.exit(1);
}
