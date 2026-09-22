import { json } from "@sveltejs/kit";
import { pocketBaseError, teacherPocketBaseRequest } from "$lib/server/pocketbase";

type Items<T> = { items?: T[] };
type Enrollment = { id: string; student: string };

// Sending students to one step of a learning path. A single action covers the
// student who was never on this path, the one already partway along it, and the
// one who had finished it: the first gets an enrollment here, the second has
// their current step set here, and the third is made active again.
//
// Moving grants the release, forwards or backwards — deciding what a student
// does next is the release decision, so there is no second button. Steps a
// student passes over are simply never sat: nothing is recorded as passed, no
// attempt records are written for them, and no attempt already in their history
// is ever removed.
export async function POST({ request, cookies }) {
  const body = await request.json();
  const picked: unknown[] = Array.isArray(body.students) ? body.students : [];
  const students = [...new Set(picked.filter((id): id is string => typeof id === "string" && Boolean(id)))];
  const progression = typeof body.progression === "string" ? body.progression : "";
  const step = typeof body.step === "string" ? body.step : "";
  if (!progression || !step) return json({ message: "Choose a quiz to send students to." }, { status: 400 });
  if (!students.length) return json({ message: "Pick at least one student." }, { status: 400 });

  let moved = 0;
  try {
    // The step has to belong to this path, or a student could be parked on a
    // quiz that is not part of the work in front of them.
    const stepRecord = await teacherPocketBaseRequest<{ progression?: string }>(
      cookies,
      `/api/collections/progression_steps/records/${step}?fields=progression`,
      { errorMessage: "We could not find that quiz in this path." },
    );
    if (stepRecord.progression !== progression) return json({ message: "That quiz is not part of this path." }, { status: 400 });

    const existing = await teacherPocketBaseRequest<Items<Enrollment>>(
      cookies,
      `/api/collections/progression_enrollments/records?perPage=1000&fields=id,student&filter=${encodeURIComponent(`progression="${progression}"`)}`,
      { errorMessage: "We could not read who is already on this path." },
    );
    const enrollmentByStudent = new Map((existing.items ?? []).map((item) => [item.student, item.id]));

    for (const student of students) {
      const enrollmentId = enrollmentByStudent.get(student);
      if (enrollmentId) {
        await teacherPocketBaseRequest(cookies, `/api/collections/progression_enrollments/records/${enrollmentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentStep: step, status: "active", released: true }),
          errorMessage: "We could not move every student.",
        });
      } else {
        await teacherPocketBaseRequest(cookies, "/api/collections/progression_enrollments/records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ progression, student, currentStep: step, status: "active", released: true }),
          errorMessage: "We could not move every student.",
        });
      }
      moved++;
    }
    return json({ moved });
  } catch (caught) {
    const failure = pocketBaseError(caught, "We could not move every student.");
    return json({ message: failure.message, moved }, { status: failure.status });
  }
}
