import { error, json } from "@sveltejs/kit";
import { appearanceOf } from "$lib/server/appearance";
import { readProgressionRecord, readQuizRecord, type QuizRecord } from "$lib/server/exportRecord";
import { pocketBaseUrl } from "$lib/server/pdfResponse";

const MAX_ITEMS = 200;

// Importing only ever adds. Nothing already in the class is matched, changed or
// removed, so re-importing something you already have gives you a second copy
// rather than quietly overwriting work.
async function createQuiz(headers: Record<string, string>, classId: string, quiz: QuizRecord): Promise<string> {
  const response = await fetch(`${pocketBaseUrl}/api/collections/quizzes/records`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      class: classId,
      data: {
        title: quiz.title,
        problems: quiz.problems,
        timeLimitMinutes: quiz.timeLimitMinutes,
        showScore: quiz.showScore,
        oneAtATime: quiz.oneAtATime,
        passMessage: quiz.passMessage,
        ...appearanceOf(quiz),
      },
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "We could not save an imported quiz.");
  return body.id as string;
}

// Takes the items the dialog had selected. The browser has already been shown
// these records, but they are re-read here rather than trusted — it is not the
// authority on what is valid to store.
export async function POST({ request, cookies }) {
  const token = cookies.get("teacher_session");
  if (!token) error(401, "Please sign in again.");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const body = await request.json().catch(() => ({}));
  const classId = String(body.class ?? "").trim();
  const items: unknown[] = Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : [];
  if (!classId) return json({ message: "We could not tell which class to import into.", detail: "Reload the page and try again." }, { status: 400 });
  if (!items.length) return json({ message: "Nothing was selected.", detail: "Tick at least one quiz or progression to import." }, { status: 400 });

  let quizzes = 0;
  let progressions = 0;
  try {
    for (const item of items) {
      const entry = (item ?? {}) as Record<string, unknown>;

      if (entry.kind === "progression") {
        const progression = readProgressionRecord(entry.progression);
        if (!progression) continue;

        const quizIds: string[] = [];
        for (const quiz of progression.quizzes) quizIds.push(await createQuiz(headers, classId, quiz));
        quizzes += quizIds.length;

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
        if (!created.ok) throw new Error(saved.message || "We could not save an imported progression.");
        progressions += 1;

        // Steps carry the order the quizzes were listed in — that ordering is
        // the only thing a progression adds over a pile of quizzes.
        for (const [index, quiz] of quizIds.entries()) {
          const step = await fetch(`${pocketBaseUrl}/api/collections/progression_steps/records`, {
            method: "POST",
            headers,
            body: JSON.stringify({ progression: saved.id, quiz, position: index + 1 }),
          });
          if (!step.ok) throw new Error("A progression was imported, but one of its steps could not be added.");
        }
        continue;
      }

      const quiz = readQuizRecord(entry.quiz);
      if (!quiz) continue;
      await createQuiz(headers, classId, quiz);
      quizzes += 1;
    }

    if (!quizzes && !progressions) {
      return json({ message: "Nothing could be imported.", detail: "The selected items had no questions in them." }, { status: 400 });
    }
    return json({ quizzes, progressions });
  } catch (caught) {
    // Say what already landed, so nothing appears for no reason.
    const landed =
      quizzes || progressions
        ? `${quizzes} quiz${quizzes === 1 ? "" : "zes"} and ${progressions} progression${progressions === 1 ? "" : "s"} were added before this failed.`
        : "Nothing was added, so you can safely try again.";
    return json({ message: caught instanceof Error ? caught.message : "We could not finish that import.", detail: landed }, { status: 500 });
  }
}
