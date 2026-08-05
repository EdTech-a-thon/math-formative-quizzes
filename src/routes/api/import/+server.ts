import { error, json } from "@sveltejs/kit";
import { appearanceOf } from "$lib/server/appearance";
import { readEnvelope, type QuizRecord } from "$lib/server/exportRecord";
import { extractRecord } from "$lib/server/pdfcx";
import { pocketBaseUrl } from "$lib/server/pdfResponse";

const MAX_BYTES = 20 * 1024 * 1024;

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
  if (!classId) return json({ message: "We could not tell which class to import into." }, { status: 400 });
  if (!(file instanceof File)) return json({ message: "Choose a PDF to import." }, { status: 400 });
  if (file.size > MAX_BYTES) return json({ message: "That file is too large to import." }, { status: 400 });

  const record = await extractRecord(new Uint8Array(await file.arrayBuffer()));
  if (!record) {
    return json(
      { message: "That PDF does not carry any quiz data. Import a PDF exported from Fact Friends." },
      { status: 400 },
    );
  }
  const parsed = readEnvelope(record);
  if (!parsed) return json({ message: "That PDF's data could not be read as a quiz or a progression." }, { status: 400 });

  try {
    if (parsed.kind === "quiz") {
      await createQuiz(headers, classId, parsed.quiz);
      return json({ kind: "quiz", quizzes: 1, title: parsed.quiz.title });
    }

    const { progression } = parsed;
    const quizIds: string[] = [];
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
    return json({ message: caught instanceof Error ? caught.message : "We could not finish that import." }, { status: 500 });
  }
}
