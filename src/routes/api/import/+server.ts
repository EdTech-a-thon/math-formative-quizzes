import { error, json } from "@sveltejs/kit";
import { appearanceOf } from "$lib/server/appearance";
import { readEnvelope, type QuizRecord } from "$lib/server/exportRecord";
import { extractRecord, type ExtractFailure } from "$lib/server/pdfcx";
import { pocketBaseUrl } from "$lib/server/pdfResponse";

const MAX_BYTES = 20 * 1024 * 1024;

// Each failure gets its own wording, because "it did not work" leaves a teacher
// with nothing to try next.
const FAILURE_MESSAGES: Record<ExtractFailure, { message: string; detail: string }> = {
  "not-a-pdf": {
    message: "That file is not a PDF.",
    detail: "Choose a PDF file — the one you get from an Export button.",
  },
  "unreadable-pdf": {
    message: "That PDF could not be opened.",
    detail: "It may be damaged or password protected. Try exporting it again.",
  },
  "no-attachments": {
    message: "That PDF has no quiz data inside it.",
    detail: "Only PDFs made by an Export button carry their questions. A scanned or printed copy cannot be read back.",
  },
  "no-record": {
    message: "That PDF has attachments, but none of them hold quiz data.",
    detail: "Export the quiz or progression again and import the file you get.",
  },
  "damaged-record": {
    message: "That PDF's quiz data is damaged.",
    detail: "It was found but could not be read. Export it again from the original class.",
  },
};

// Importing only ever adds. Nothing already in the class is matched, changed or
// removed, so re-importing a file you already have gives you a second copy
// rather than quietly overwriting work.
async function createQuiz(headers: Record<string, string>, classId: string, quiz: QuizRecord): Promise<string> {
  const data = {
    title: quiz.title,
    problems: quiz.problems,
    timeLimitMinutes: quiz.timeLimitMinutes,
    showScore: quiz.showScore,
    passMessage: quiz.passMessage,
    ...appearanceOf(quiz),
  };
  const response = await fetch(`${pocketBaseUrl}/api/collections/quizzes/records`, {
    method: "POST",
    headers,
    body: JSON.stringify({ class: classId, data }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "We could not save an imported quiz.");
  return body.id as string;
}

export async function POST({ request, cookies }) {
  const token = cookies.get("teacher_session");
  if (!token) error(401, "Please sign in again.");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const form = await request.formData();
  const classId = String(form.get("class") ?? "").trim();
  const file = form.get("file");
  if (!classId) return json({ message: "We could not tell which class to import into.", detail: "Reload the page and try again." }, { status: 400 });
  if (!(file instanceof File)) return json({ message: "No file was chosen.", detail: "Pick a PDF to import." }, { status: 400 });
  if (!file.size) return json({ message: "That file is empty.", detail: "Nothing was uploaded — try choosing the file again." }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return json(
      { message: "That file is too big to import.", detail: `The limit is 20 MB and this one is ${(file.size / 1024 / 1024).toFixed(1)} MB.` },
      { status: 400 },
    );
  }

  const extracted = await extractRecord(new Uint8Array(await file.arrayBuffer()));
  if (!extracted.ok) return json(FAILURE_MESSAGES[extracted.reason], { status: 400 });

  const parsed = readEnvelope(extracted.record);
  if (!parsed) {
    return json(
      {
        message: "That PDF holds data, but not a quiz or a progression.",
        detail: "It carries a record this app does not recognise, or one with no questions in it.",
      },
      { status: 400 },
    );
  }

  // Tracked outside the try so a failure part-way can say what already landed
  // rather than leaving the teacher to guess why quizzes appeared anyway.
  const quizIds: string[] = [];
  try {
    if (parsed.kind === "quiz") {
      await createQuiz(headers, classId, parsed.quiz);
      return json({ kind: "quiz", quizzes: 1, title: parsed.quiz.title });
    }

    const { progression } = parsed;
    for (const quiz of progression.quizzes) quizIds.push(await createQuiz(headers, classId, quiz));

    const created = await fetch(`${pocketBaseUrl}/api/collections/progressions/records`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        class: classId,
        name: progression.name,
        description: progression.description,
        passPercentage: progression.passPercentage,
        ...appearanceOf(progression),
      }),
    });
    const saved = await created.json().catch(() => ({}));
    if (!created.ok) throw new Error(saved.message || "We could not save the imported progression.");

    // Steps carry the order the quizzes arrived in — that ordering is the only
    // thing a progression adds over a pile of quizzes.
    for (const [index, quiz] of quizIds.entries()) {
      const step = await fetch(`${pocketBaseUrl}/api/collections/progression_steps/records`, {
        method: "POST",
        headers,
        body: JSON.stringify({ progression: saved.id, quiz, position: index + 1 }),
      });
      if (!step.ok) throw new Error("The progression was imported, but a step could not be added.");
    }
    return json({ kind: "progression", quizzes: quizIds.length, title: progression.name });
  } catch (caught) {
    const landed = quizIds.length
      ? `${quizIds.length} quiz${quizIds.length === 1 ? "" : "zes"} were added before this failed, so you may want to delete them and try again.`
      : "Nothing was added, so you can safely try again.";
    return json(
      { message: caught instanceof Error ? caught.message : "We could not finish that import.", detail: landed },
      { status: 500 },
    );
  }
}
