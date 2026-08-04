import { error, json } from "@sveltejs/kit";

const pocketBaseUrl = "http://127.0.0.1:8090";

// Deleting a class cascades to its students, quizzes, progressions, steps,
// enrollments, and attempts (all their `class`/parent relations use
// cascadeDelete). PocketBase's collection rule ensures only the owning teacher
// can delete their own class.
export async function DELETE({ params, cookies }) {
  const teacherToken = cookies.get("teacher_session");
  if (!teacherToken) error(401, "Please sign in again.");

  const response = await fetch(`${pocketBaseUrl}/api/collections/classes/records/${params.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${teacherToken}` },
  });

  if (!response.ok && response.status !== 204) {
    const body = await response.json().catch(() => ({}));
    return json({ message: body.message || "We could not delete this class." }, { status: response.status });
  }
  return json({ ok: true });
}
