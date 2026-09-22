import { json } from "@sveltejs/kit";
import { appearanceOf } from "$lib/server/appearance";
import { pocketBaseError, teacherPocketBaseRequest } from "$lib/server/pocketbase";

type Step = { id: string; quiz: string; position: number };
type Items<T> = { items: T[] };

export async function PATCH({ request, cookies, params }) {
  const body = await request.json();
  if (!String(body.name || "").trim() || !Array.isArray(body.quizIds) || !body.quizIds.length)
    return json({ message: "Add a name and at least one quiz." }, { status: 400 });

  try {
    const progression = await teacherPocketBaseRequest(
      cookies,
      `/api/collections/progressions/records/${params.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: body.name.trim(), description: String(body.description || "").trim(), passPercentage: Number(body.passPercentage) || 80, oneAtATime: body.oneAtATime === true, showAnswers: body.showAnswers === true, selfPaced: body.selfPaced === true, ...appearanceOf(body) }),
        errorMessage: "We could not save this learning path.",
      },
    );

    const steps = await teacherPocketBaseRequest<Items<Step>>(
      cookies,
      `/api/collections/progression_steps/records?perPage=500&filter=${encodeURIComponent(`progression="${params.id}"`)}`,
      { errorMessage: "The learning path was saved, but its steps could not be read.", preferErrorMessage: true },
    );
    const existing = steps.items;

    // Reuse the step records for quizzes that are staying put. Deleting a step
    // cascades away every recorded attempt against it, so only steps the teacher
    // actually removed from the path are deleted.
    const quizIds: string[] = body.quizIds;
    const keep = new Map<string, Step>();
    const remove: Step[] = [];
    for (const step of existing) {
      if (quizIds.includes(step.quiz) && !keep.has(step.quiz)) keep.set(step.quiz, step);
      else remove.push(step);
    }

    for (const step of remove) {
      await teacherPocketBaseRequest(
        cookies,
        `/api/collections/progression_steps/records/${step.id}`,
        { method: "DELETE", errorMessage: "The learning path was saved, but a removed step could not be deleted.", preferErrorMessage: true },
      );
    }

    // (progression, position) is unique, so park the survivors above the range
    // before writing their final positions — otherwise a reorder collides with a
    // position that is still held by another step.
    const parked = existing.length + quizIds.length;
    for (const [index, step] of [...keep.values()].entries()) {
      await teacherPocketBaseRequest(
        cookies,
        `/api/collections/progression_steps/records/${step.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: parked + index + 1 }),
          errorMessage: "The learning path was saved, but its steps could not be reordered.",
          preferErrorMessage: true,
        },
      );
    }

    for (const [index, quiz] of quizIds.entries()) {
      const step = keep.get(quiz);
      await teacherPocketBaseRequest(
        cookies,
        step ? `/api/collections/progression_steps/records/${step.id}` : "/api/collections/progression_steps/records",
        {
          method: step ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(step ? { position: index + 1 } : { progression: params.id, quiz, position: index + 1 }),
          errorMessage: "The learning path was saved, but a step could not be updated.",
          preferErrorMessage: true,
        },
      );
    }

    // Turning on self-paced mode should help students who are already waiting,
    // not only students assigned after this setting changes.
    if (body.selfPaced === true) {
      const filter = encodeURIComponent(`progression="${params.id}" && status="active" && released=false`);
      const enrollments = await teacherPocketBaseRequest<Items<{ id: string }>>(
        cookies,
        `/api/collections/progression_enrollments/records?perPage=2000&fields=id&filter=${filter}`,
        { errorMessage: "The learning path was saved, but waiting students could not be released.", preferErrorMessage: true },
      );
      for (const enrollment of enrollments.items) {
        await teacherPocketBaseRequest(
          cookies,
          `/api/collections/progression_enrollments/records/${enrollment.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ released: true }),
            errorMessage: "The learning path was saved, but some waiting students could not be released.",
            preferErrorMessage: true,
          },
        );
      }
    }

    return json(progression);
  } catch (caught) {
    const failure = pocketBaseError(caught, "We could not save this learning path.");
    return json({ message: failure.message }, { status: failure.status });
  }
}

// Deleting a learning path takes its steps and every student's place on it
// with it (and so their attempt history on it), but never a quiz: quizzes
// belong to the teacher's library and may be used by other paths.
export async function DELETE({ cookies, params }) {
  try {
    await teacherPocketBaseRequest(cookies, `/api/collections/progressions/records/${params.id}`, {
      method: "DELETE",
      errorMessage: "We could not delete this learning path.",
    });
    return json({ ok: true });
  } catch (caught) {
    const failure = pocketBaseError(caught, "We could not delete this learning path.");
    return json({ message: failure.message }, { status: failure.status });
  }
}
