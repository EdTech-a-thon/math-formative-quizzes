import { json } from "@sveltejs/kit";
import { appearanceOf } from "$lib/server/appearance";
import { pocketBaseError, teacherPocketBaseRequest } from "$lib/server/pocketbase";
import { readProblems } from "$lib/quizProblems";

export async function PATCH({ request, cookies, params }) {
  const body = await request.json();
  if (!body.data?.title || !readProblems(body.data.problems).length)
    return json({ message: "Add a title and at least one question." }, { status: 400 });

  try {
    const result = await teacherPocketBaseRequest(
      cookies,
      `/api/collections/quizzes/records/${params.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { ...body.data, ...appearanceOf(body.data) } }),
        errorMessage: "We could not save this quiz.",
      },
    );
    return json(result);
  } catch (caught) {
    const failure = pocketBaseError(caught, "We could not save this quiz.");
    return json({ message: failure.message }, { status: failure.status });
  }
}

export async function DELETE({ cookies, params }) {
  try {
    await teacherPocketBaseRequest(
      cookies,
      `/api/collections/quizzes/records/${params.id}`,
      { method: "DELETE", errorMessage: "We could not delete this quiz." },
    );
    return json({ ok: true });
  } catch (caught) {
    const failure = pocketBaseError(caught, "We could not delete this quiz.");
    return json({ message: failure.message }, { status: failure.status });
  }
}
