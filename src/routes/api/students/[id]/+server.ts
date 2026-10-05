import { json } from "@sveltejs/kit";
import { pocketBaseError, teacherPocketBaseRequest } from "$lib/server/pocketbase";

// Save one student's accommodations. Only the settings sent are changed, so a
// later accommodation can be saved without clearing extra time.
export async function PATCH({ cookies, params, request }) {
  const body = await request.json().catch(() => ({}));

  try {
    const current = await teacherPocketBaseRequest<{ accommodations?: Record<string, unknown> }>(
      cookies,
      `/api/collections/students/records/${params.id}?fields=accommodations`,
      { errorMessage: "We could not find this student." },
    );
    const accommodations = { ...(current.accommodations ?? {}) };
    if (body.extraTimeMinutes !== undefined) {
      accommodations.extraTimeMinutes = Math.min(60, Math.max(0, Math.round(Number(body.extraTimeMinutes)) || 0));
    }

    await teacherPocketBaseRequest(
      cookies,
      `/api/collections/students/records/${params.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accommodations }),
        errorMessage: "We could not save these accommodations.",
      },
    );
    return json({ accommodations });
  } catch (caught) {
    const failure = pocketBaseError(caught, "We could not save these accommodations.");
    return json({ message: failure.message }, { status: failure.status });
  }
}

// Remove a student from their class. With `mergeIntoId`, their enrollments and
// attempts move to that student first (for a duplicate student); without it,
// their work is deleted with them.
export async function DELETE({ cookies, params, request }) {
  const body = await request.json().catch(() => ({}));
  const errorMessage = "We could not remove this student.";

  try {
    await teacherPocketBaseRequest(cookies, "/api/fact-friends/remove-student", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: params.id, mergeIntoId: String(body.mergeIntoId ?? "") }),
      errorMessage,
    });
    return json({ ok: true });
  } catch (caught) {
    const failure = pocketBaseError(caught, errorMessage);
    return json({ message: failure.message }, { status: failure.status });
  }
}
