import { json } from "@sveltejs/kit";
import { appearanceOf } from "$lib/server/appearance";
import { pocketBaseError, teacherPocketBaseRequest } from "$lib/server/pocketbase";
import { readProblems } from "$lib/quizProblems";

export async function POST({ request, cookies, locals }) {
  const body = await request.json();
  if (!body.data?.title || !readProblems(body.data.problems).length)
    return json({ message: "Add a title and at least one question." }, { status: 400 });
  // A new quiz belongs to the signed-in teacher, so the owner is taken from her
  // session rather than from anything the browser sent.
  if (!locals.teacher) return json({ message: "Please sign in again." }, { status: 401 });

  try {
    const result = await teacherPocketBaseRequest(
      cookies,
      "/api/collections/quizzes/records",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacher: locals.teacher.id, data: { ...body.data, ...appearanceOf(body.data) } }),
        errorMessage: "We could not save this quiz.",
      },
    );
    return json(result);
  } catch (caught) {
    const failure = pocketBaseError(caught, "We could not save this quiz.");
    return json({ message: failure.message }, { status: failure.status });
  }
}
