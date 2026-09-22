import { json } from "@sveltejs/kit";
import { readProgressionRecord, readQuizRecord } from "$lib/server/exportRecord";
import { saveProgression, saveQuiz } from "$lib/server/saveProgression";
import { teacherAuthorization } from "$lib/server/pocketbase";

const MAX_ITEMS = 200;

// Takes the items the dialog had selected. The browser has already been shown
// these records, but they are re-read here rather than trusted — it is not the
// authority on what is valid to store.
export async function POST({ request, cookies, locals }) {
  const authorization = teacherAuthorization(cookies);
  // Imported quizzes belong to the teacher; only the learning path they arrive
  // in belongs to the class being imported into.
  const teacherId = locals.teacher?.id ?? "";

  const body = await request.json().catch(() => ({}));
  const classId = String(body.class ?? "").trim();
  const items: unknown[] = Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : [];
  if (!classId) return json({ message: "We could not tell which class to import into.", detail: "Reload the page and try again." }, { status: 400 });
  if (!items.length) return json({ message: "Nothing was selected.", detail: "Tick at least one quiz or learning path to import." }, { status: 400 });

  let quizzes = 0;
  let progressions = 0;
  try {
    for (const item of items) {
      const entry = (item ?? {}) as Record<string, unknown>;

      if (entry.kind === "progression") {
        const progression = readProgressionRecord(entry.progression);
        if (!progression) continue;

        await saveProgression(authorization, { teacherId, classId }, progression, {
          quiz: () => quizzes++,
          progression: () => progressions++,
        });
        continue;
      }

      const quiz = readQuizRecord(entry.quiz);
      if (!quiz) continue;
      await saveQuiz(authorization, teacherId, quiz);
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
        ? `${quizzes} quiz${quizzes === 1 ? "" : "zes"} and ${progressions} learning path${progressions === 1 ? "" : "s"} were added before this failed.`
        : "Nothing was added, so you can safely try again.";
    return json({ message: caught instanceof Error ? caught.message : "We could not finish that import.", detail: landed }, { status: 500 });
  }
}
