import { json } from "@sveltejs/kit";
import { appearanceOf } from "$lib/server/appearance";
import { pocketBaseError, teacherPocketBaseRequest } from "$lib/server/pocketbase";

export async function POST({ request, cookies }) {
  const body = await request.json();
  if (!body.class || !String(body.name || "").trim() || !Array.isArray(body.quizIds) || !body.quizIds.length)
    return json({ message: "Add a name and at least one quiz." }, { status: 400 });

  try {
    const progression = await teacherPocketBaseRequest<{ id: string }>(
      cookies,
      "/api/collections/progressions/records",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class: body.class, name: body.name.trim(), description: String(body.description || "").trim(), passPercentage: Number(body.passPercentage) || 80, oneAtATime: body.oneAtATime === true, showAnswers: body.showAnswers === true, selfPaced: body.selfPaced === true, ...appearanceOf(body) }),
        errorMessage: "We could not save this progression.",
      },
    );

    for (const [index, quiz] of body.quizIds.entries()) {
      await teacherPocketBaseRequest(
        cookies,
        "/api/collections/progression_steps/records",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ progression: progression.id, quiz, position: index + 1 }),
          errorMessage: "The progression was saved, but a step could not be added.",
          preferErrorMessage: true,
        },
      );
    }
    return json(progression);
  } catch (caught) {
    const failure = pocketBaseError(caught, "We could not save this progression.");
    return json({ message: failure.message }, { status: failure.status });
  }
}
