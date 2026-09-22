import { json } from "@sveltejs/kit";
import { pocketBaseError, teacherPocketBaseRequest } from "$lib/server/pocketbase";

type Quiz = { id: string; data: unknown };
type Step = { id: string; quiz: string };
type Items<T> = { items: T[] };

// Makes a plain, independent copy of a quiz and repoints only the current
// class's learning path at it. See docs/adr/0001-quizzes-belong-to-the-teacher.md
// for why an escape hatch like this is needed now that quizzes are shared.
export async function POST({ request, cookies, params, locals }) {
  const body = await request.json();
  const classId = String(body.classId || "").trim();
  if (!classId) return json({ message: "A class is required to make a copy for." }, { status: 400 });
  if (!locals.teacher) return json({ message: "Please sign in again." }, { status: 401 });

  try {
    // Fetching through the teacher's own session is the ownership check: a
    // quiz that is not hers 404s here rather than being copyable at all.
    const original = await teacherPocketBaseRequest<Quiz>(
      cookies,
      `/api/collections/quizzes/records/${params.id}`,
      { errorMessage: "We could not find this quiz." },
    );

    // A plain, independent copy: no "forked from" field, no link back to the
    // original. Deep-cloning the settings means the copy's problems array is
    // its own value, not a reference into the original's, though PocketBase
    // would have serialized it apart either way.
    const copy = await teacherPocketBaseRequest<Quiz>(
      cookies,
      "/api/collections/quizzes/records",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacher: locals.teacher.id, data: JSON.parse(JSON.stringify(original.data ?? {})) }),
        errorMessage: "We could not make a copy of this quiz.",
      },
    );

    // Only the current class's path moves to the copy. Its step records stay
    // exactly as they are and only their `quiz` field changes, so a student's
    // place (an enrollment's currentStep points at a step, never a quiz) is
    // untouched, and every attempt already recorded against the original quiz
    // keeps pointing at it, exactly as it should.
    // Every one of the class's learning paths, not just its first: a class can
    // run addition and multiplication side by side, and the quiz may sit in
    // either. A hidden single-quiz path from "assign on its own" is not one of
    // them, and stays pointing at the original.
    const steps = await teacherPocketBaseRequest<Items<Step>>(
      cookies,
      `/api/collections/progression_steps/records?perPage=500&filter=${encodeURIComponent(`progression.class="${classId}" && progression.standalone != true && quiz="${params.id}"`)}`,
      { errorMessage: "The copy was made, but this class's path could not be updated.", preferErrorMessage: true },
    );
    for (const step of steps.items) {
      await teacherPocketBaseRequest(
        cookies,
        `/api/collections/progression_steps/records/${step.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quiz: copy.id }),
          errorMessage: "The copy was made, but this class's path could not be updated.",
          preferErrorMessage: true,
        },
      );
    }

    return json(copy);
  } catch (caught) {
    const failure = pocketBaseError(caught, "We could not make a copy of this quiz.");
    return json({ message: failure.message }, { status: failure.status });
  }
}
