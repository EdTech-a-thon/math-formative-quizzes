import { json } from "@sveltejs/kit";
import { pocketBaseError, teacherPocketBaseRequest } from "$lib/server/pocketbase";

type Enrollment = { status: string; released: boolean };

export async function DELETE({ cookies, params }) {
  try {
    await teacherPocketBaseRequest(
      cookies,
      `/api/collections/progression_enrollments/records/${params.id}`,
      { method: "DELETE", errorMessage: "We could not remove this assignment." },
    );
    return json({ ok: true });
  } catch (caught) {
    const failure = pocketBaseError(caught, "We could not remove this assignment.");
    return json({ message: failure.message }, { status: failure.status });
  }
}

export async function PATCH({ cookies, params }) {
  try {
    const current = await teacherPocketBaseRequest<Enrollment>(
      cookies,
      `/api/collections/progression_enrollments/records/${params.id}?fields=status,released`,
      { errorMessage: "We could not find this assignment." },
    );
    if (current.status === "completed") return json({ message: "This progression is already complete." }, { status: 400 });
    if (current.released) return json({ released: true });

    await teacherPocketBaseRequest(
      cookies,
      `/api/collections/progression_enrollments/records/${params.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ released: true }),
        errorMessage: "We could not release this attempt.",
      },
    );
    return json({ released: true });
  } catch (caught) {
    const failure = pocketBaseError(caught, "We could not release this attempt.");
    return json({ message: failure.message }, { status: failure.status });
  }
}
