import { json } from "@sveltejs/kit";
import { pocketBaseError, teacherPocketBaseRequest } from "$lib/server/pocketbase";

// Deleting a class cascades to its students, progressions, steps,
// enrollments, and attempts (all their `class`/parent relations use
// cascadeDelete). Quizzes belong to the teacher, not the class, so they are
// never touched by this — they stay available to the teacher's other
// classes. PocketBase's collection rule ensures only the owning teacher can
// delete their own class.
export async function DELETE({ params, cookies }) {
  try {
    await teacherPocketBaseRequest(
      cookies,
      `/api/collections/classes/records/${params.id}`,
      { method: "DELETE", errorMessage: "We could not delete this class." },
    );
    return json({ ok: true });
  } catch (caught) {
    const failure = pocketBaseError(caught, "We could not delete this class.");
    return json({ message: failure.message }, { status: failure.status });
  }
}
