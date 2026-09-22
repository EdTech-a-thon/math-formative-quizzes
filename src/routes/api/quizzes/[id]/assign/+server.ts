import { json } from "@sveltejs/kit";
import { appearanceOf } from "$lib/server/appearance";
import { pocketBaseError, teacherPocketBaseRequest } from "$lib/server/pocketbase";

type Items<T> = { items?: T[] };
type Quiz = { id: string; data?: { title?: string; icon?: string; shade?: string } };
type Step = { id: string; progression: string };

// Giving students one quiz on its own. Behind the scenes that is a learning
// path holding only this quiz, flagged `standalone` so it never shows up in the
// teacher's list of paths — which is what lets a single quiz travel the same
// step-and-enrollment pipeline every other quiz already travels, rather than
// needing a second one built beside it. See
// docs/adr/0002-one-off-quizzes-are-hidden-single-step-paths.md.
//
// There is one hidden path per quiz per class, reused on every later assign, so
// "who still has this quiz and who has finished it" stays one answer instead of
// one per time the teacher handed it out.
export async function POST({ request, cookies, params }) {
  const body = await request.json();
  const classId = String(body.classId || "").trim();
  const picked: unknown[] = Array.isArray(body.students) ? body.students : [];
  const students = [...new Set(picked.filter((id): id is string => typeof id === "string" && Boolean(id)))];
  // A quiz handed out on its own is still retried until it is passed, so it
  // needs a passing score just like a quiz inside a path does.
  const passPercentage = Math.min(100, Math.max(1, Math.round(Number(body.passPercentage)) || 80));
  // Always self-paced: a quiz handed out on its own is meant to be started
  // straight away, never held back waiting for a release.
  const selfPaced = true;

  if (!classId) return json({ message: "Choose a class to assign this quiz in." }, { status: 400 });
  if (!students.length) return json({ message: "Pick at least one student." }, { status: 400 });

  let assigned = 0;
  let skipped = 0;
  try {
    // Fetched through her own session, so a quiz or a class that is not hers
    // simply is not found rather than being assignable.
    const quiz = await teacherPocketBaseRequest<Quiz>(cookies, `/api/collections/quizzes/records/${params.id}`, {
      errorMessage: "We could not find this quiz.",
    });
    await teacherPocketBaseRequest(cookies, `/api/collections/classes/records/${classId}?fields=id`, {
      errorMessage: "We could not find this class.",
    });
    const title = quiz.data?.title || "Quiz";

    const held = await teacherPocketBaseRequest<Items<Step>>(
      cookies,
      `/api/collections/progression_steps/records?perPage=1&fields=id,progression&filter=${encodeURIComponent(
        `quiz="${params.id}" && progression.class="${classId}" && progression.standalone=true`,
      )}`,
      { errorMessage: "We could not check whether this quiz was already given out." },
    );

    let progression = held.items?.[0]?.progression ?? "";
    let step = held.items?.[0]?.id ?? "";
    // The quiz's own name and look, so a teacher reading a student's page sees
    // the quiz she assigned and not a made-up container around it.
    const settings = {
      name: title,
      passPercentage,
      selfPaced,
      standalone: true,
      ...appearanceOf(quiz.data ?? {}),
    };

    if (progression) {
      // The settings she just chose are the current ones, and the quiz may have
      // been renamed since it was last handed out.
      await teacherPocketBaseRequest(cookies, `/api/collections/progressions/records/${progression}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
        errorMessage: "We could not save this quiz's settings.",
      });
    } else {
      const created = await teacherPocketBaseRequest<{ id: string }>(cookies, "/api/collections/progressions/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class: classId, description: "", ...settings }),
        errorMessage: "We could not give out this quiz.",
      });
      progression = created.id;
      const madeStep = await teacherPocketBaseRequest<{ id: string }>(cookies, "/api/collections/progression_steps/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progression, quiz: params.id, position: 1 }),
        errorMessage: "We could not give out this quiz.",
      });
      step = madeStep.id;
    }

    const existing = await teacherPocketBaseRequest<Items<{ student: string }>>(
      cookies,
      `/api/collections/progression_enrollments/records?perPage=1000&fields=student&filter=${encodeURIComponent(`progression="${progression}"`)}`,
      { errorMessage: "We could not read who already has this quiz." },
    );
    const alreadyHasIt = new Set((existing.items ?? []).map((item) => item.student));

    for (const student of students) {
      if (alreadyHasIt.has(student)) {
        skipped++;
        continue;
      }
      await teacherPocketBaseRequest(cookies, "/api/collections/progression_enrollments/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progression, student, currentStep: step, status: "active", released: selfPaced }),
        errorMessage: "We could not give this quiz to every student.",
      });
      assigned++;
    }

    return json({ assigned, skipped });
  } catch (caught) {
    const failure = pocketBaseError(caught, "We could not give out this quiz.");
    return json({ message: failure.message, assigned, skipped }, { status: failure.status });
  }
}
