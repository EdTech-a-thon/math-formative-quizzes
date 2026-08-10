import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { answerFor, type Operation, type Problem } from "$lib/quizProblems";
import { attachRecord } from "$lib/server/pdfcx";
import { progressionEnvelope, quizEnvelope, type ProgressionRecord, type QuizRecord } from "$lib/server/exportRecord";

// A4, and a margin close to the 1.5cm the on-screen print stylesheet uses, so
// this and the browser's own Print produce the same document.
const PAGE: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const WIDTH = PAGE[0] - MARGIN * 2;
const COLUMNS = 4;
const CELL_WIDTH = WIDTH / COLUMNS;
const CELL_HEIGHT = 74;

const INK = rgb(0, 0, 0);
const MUTED = rgb(0.42, 0.4, 0.47);
const RULE = rgb(0.75, 0.72, 0.79);

// The app's own fonts come from a web stylesheet, so there is nothing to embed.
// Courier stands in for DM Mono to keep the number stacks aligned.
type Fonts = { body: PDFFont; bold: PDFFont; mono: PDFFont };

// The standard PDF fonts speak WinAnsi, which covers Latin-1 and no more. The
// app shows a true minus sign (U+2212) that WinAnsi has no room for, so the
// page uses a hyphen for subtraction. × and ÷ are both in Latin-1 and stay.
const PDF_SYMBOL: Record<Operation, string> = {
  multiplication: "×",
  division: "÷",
  addition: "+",
  subtraction: "-",
};

const SUBSTITUTES: Record<string, string> = {
  "−": "-", "–": "-", "—": "-", "‘": "'", "’": "'",
  "“": '"', "”": '"', "…": "...", " ": " ",
};

// Titles and messages are whatever a teacher typed, so anything WinAnsi cannot
// encode is swapped for a near-equivalent or dropped. Without this an emoji in
// a quiz name would fail the whole export rather than just look wrong.
function safe(value: string): string {
  let out = "";
  for (const character of value) {
    const swap = SUBSTITUTES[character];
    if (swap !== undefined) { out += swap; continue; }
    const code = character.codePointAt(0) ?? 0;
    if (code >= 0x20 && code <= 0x7e) out += character;
    else if (code >= 0xa0 && code <= 0xff) out += character;
  }
  return out;
}

function newPage(pdf: PDFDocument): PDFPage {
  return pdf.addPage(PAGE);
}

// A heading with a rule under it. Returns the y to carry on drawing from.
function drawHeading(page: PDFPage, fonts: Fonts, title: string, aside: string, meta: string): number {
  let y = PAGE[1] - MARGIN;
  page.drawText(safe(title), { x: MARGIN, y: y - 20, size: 20, font: fonts.bold, color: INK });
  if (aside) {
    const width = fonts.body.widthOfTextAtSize(safe(aside), 10);
    page.drawText(safe(aside), { x: PAGE[0] - MARGIN - width, y: y - 16, size: 10, font: fonts.body, color: MUTED });
  }
  y -= 32;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE[0] - MARGIN, y }, thickness: 1.2, color: INK });
  if (meta) {
    y -= 16;
    page.drawText(safe(meta), { x: MARGIN, y, size: 9.5, font: fonts.body, color: MUTED });
  }
  return y - 22;
}

// One question: its number, the stack, and room underneath to write the answer.
function drawProblem(page: PDFPage, fonts: Fonts, problem: Problem, index: number, x: number, y: number) {
  page.drawText(`${index + 1}.`, { x, y: y - 11, size: 9, font: fonts.bold, color: MUTED });

  const top = String(problem.top);
  const bottom = `${PDF_SYMBOL[problem.op]} ${problem.bottom}`;
  const size = 15;
  const right = x + CELL_WIDTH - 22;
  const topWidth = fonts.mono.widthOfTextAtSize(top, size);
  const bottomWidth = fonts.mono.widthOfTextAtSize(bottom, size);
  const stackLeft = Math.min(right - topWidth, right - bottomWidth) - 4;

  page.drawText(top, { x: right - topWidth, y: y - 12, size, font: fonts.mono, color: INK });
  page.drawText(bottom, { x: right - bottomWidth, y: y - 30, size, font: fonts.mono, color: INK });
  page.drawLine({ start: { x: stackLeft, y: y - 37 }, end: { x: right, y: y - 37 }, thickness: 1.1, color: INK });
  // The blank the student writes in.
  page.drawLine({ start: { x: stackLeft, y: y - 62 }, end: { x: right, y: y - 62 }, thickness: 0.6, color: RULE });
}

// Lay every question out four across, starting a fresh page when one fills up.
function drawWorksheet(pdf: PDFDocument, fonts: Fonts, quiz: QuizRecord, aside: string) {
  const meta = `Name: ______________________     Date: ______________     ${quiz.timeLimitMinutes} min  ·  ${quiz.problems.length} question${quiz.problems.length === 1 ? "" : "s"}`;
  let page = newPage(pdf);
  let y = drawHeading(page, fonts, quiz.title, aside, meta);

  quiz.problems.forEach((problem, index) => {
    const column = index % COLUMNS;
    if (column === 0 && index > 0) y -= CELL_HEIGHT;
    if (y < MARGIN + CELL_HEIGHT) {
      page = newPage(pdf);
      y = drawHeading(page, fonts, quiz.title, `${aside}${aside ? " · " : ""}continued`, "");
    }
    drawProblem(page, fonts, problem, index, MARGIN + column * CELL_WIDTH, y);
  });
}

// The key is derived from the same list the worksheet drew, never restated, so
// the two cannot disagree.
function drawAnswerKey(pdf: PDFDocument, fonts: Fonts, sections: { title: string; problems: Problem[] }[]) {
  let page = newPage(pdf);
  let y = drawHeading(page, fonts, "Answer key", "", "For the teacher — not for handing out.");
  const perRow = 4;
  const cellWidth = WIDTH / perRow;

  for (const section of sections) {
    if (y < MARGIN + 50) {
      page = newPage(pdf);
      y = drawHeading(page, fonts, "Answer key", "continued", "");
    }
    if (sections.length > 1) {
      page.drawText(safe(section.title), { x: MARGIN, y, size: 11, font: fonts.bold, color: INK });
      y -= 16;
    }
    section.problems.forEach((problem, index) => {
      const column = index % perRow;
      if (column === 0 && index > 0) y -= 16;
      if (y < MARGIN) {
        page = newPage(pdf);
        y = drawHeading(page, fonts, "Answer key", "continued", "");
      }
      const line = `${index + 1}. ${problem.top} ${PDF_SYMBOL[problem.op]} ${problem.bottom} = ${answerFor(problem)}`;
      page.drawText(line, { x: MARGIN + column * cellWidth, y, size: 9.5, font: fonts.mono, color: INK });
    });
    y -= 30;
  }
}

async function startDocument(): Promise<{ pdf: PDFDocument; fonts: Fonts }> {
  const pdf = await PDFDocument.create();
  return {
    pdf,
    fonts: {
      body: await pdf.embedFont(StandardFonts.Helvetica),
      bold: await pdf.embedFont(StandardFonts.HelveticaBold),
      mono: await pdf.embedFont(StandardFonts.CourierBold),
    },
  };
}

export async function renderQuizPdf(quiz: QuizRecord): Promise<Uint8Array> {
  const { pdf, fonts } = await startDocument();
  pdf.setTitle(quiz.title);
  pdf.setSubject("Fact Friends quiz");

  drawWorksheet(pdf, fonts, quiz, "");
  drawAnswerKey(pdf, fonts, [{ title: quiz.title, problems: quiz.problems }]);

  await attachRecord(pdf, quizEnvelope(quiz));
  return pdf.save();
}

export async function renderProgressionPdf(progression: ProgressionRecord): Promise<Uint8Array> {
  const { pdf, fonts } = await startDocument();
  pdf.setTitle(progression.name);
  pdf.setSubject("Fact Friends progression");

  // Cover: what the path is, and every step in the order learners meet them.
  const total = progression.quizzes.reduce((sum, quiz) => sum + quiz.problems.length, 0);
  const cover = newPage(pdf);
  let y = drawHeading(
    cover,
    fonts,
    progression.name,
    "Learning path",
    `Pass at ${progression.passPercentage}%  ·  ${progression.quizzes.length} quiz${progression.quizzes.length === 1 ? "" : "zes"}  ·  ${total} question${total === 1 ? "" : "s"}  ·  ${progression.oneAtATime ? "one question at a time" : "all questions at once"}`,
  );
  if (progression.description) {
    cover.drawText(safe(progression.description).slice(0, 110), { x: MARGIN, y, size: 11, font: fonts.body, color: MUTED });
    y -= 26;
  }
  progression.quizzes.forEach((quiz, index) => {
    if (y < MARGIN + 20) return; // A very long path just lists what fits; every quiz still follows.
    cover.drawText(`${index + 1}.`, { x: MARGIN, y, size: 11, font: fonts.bold, color: MUTED });
    cover.drawText(safe(quiz.title), { x: MARGIN + 26, y, size: 11, font: fonts.body, color: INK });
    const count = `${quiz.problems.length} question${quiz.problems.length === 1 ? "" : "s"}`;
    const width = fonts.body.widthOfTextAtSize(count, 10);
    cover.drawText(count, { x: PAGE[0] - MARGIN - width, y, size: 10, font: fonts.body, color: MUTED });
    y -= 19;
  });

  progression.quizzes.forEach((quiz, index) => {
    drawWorksheet(pdf, fonts, quiz, `Step ${index + 1} of ${progression.quizzes.length}`);
  });
  drawAnswerKey(pdf, fonts, progression.quizzes.map((quiz, index) => ({ title: `${index + 1}. ${quiz.title}`, problems: quiz.problems })));

  await attachRecord(pdf, progressionEnvelope(progression));
  return pdf.save();
}
