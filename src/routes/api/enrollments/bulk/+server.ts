import { json } from "@sveltejs/kit";
import { pocketBaseError, teacherPocketBaseRequest } from "$lib/server/pocketbase";

function idList(value: unknown, single: unknown) {
  const list = Array.isArray(value) ? value : [single];
  return [...new Set(list.filter((id: unknown): id is string => typeof id === "string" && Boolean(id)))];
}

type Items<T> = { items?: T[] };

// Every assignment in the app comes through here: any number of students onto
// any number of progressions. Pairs that already exist are left alone, so
// assigning twice never resets anybody's progress.
export async function POST({ request, cookies }) {
  const body = await request.json();
  const students = idList(body.students, body.student);
  const progressions = idList(body.progressions, body.progression);
  if (!progressions.length || !students.length)
    return json({ message: "Pick at least one student and one learning path." }, { status: 400 });

  let assigned = 0;
  let skipped = 0;

  try {
    for (const progression of progressions) {
      const progressionRecord = await teacherPocketBaseRequest<{ selfPaced?: boolean }>(
        cookies,
        `/api/collections/progressions/records/${progression}?fields=selfPaced`,
        { errorMessage: "We could not find one of those learning paths.", preferErrorMessage: true },
      );

      // Start each new student on this progression's first step.
      const steps = await teacherPocketBaseRequest<Items<{ id: string }>>(
        cookies,
        `/api/collections/progression_steps/records?perPage=1&sort=position&filter=progression%3D%22${progression}%22`,
        { errorMessage: "We could not read this learning path's steps." },
      );
      const firstStep = steps.items?.[0]?.id;

      const existing = await teacherPocketBaseRequest<Items<{ student: string }>>(
        cookies,
        `/api/collections/progression_enrollments/records?perPage=1000&fields=student&filter=progression%3D%22${progression}%22`,
        { errorMessage: "We could not read this learning path's assignments." },
      );
      const alreadyOn = new Set((existing.items ?? []).map((item) => item.student));

      for (const student of students) {
        if (alreadyOn.has(student)) {
          skipped++;
          continue;
        }
        await teacherPocketBaseRequest(
          cookies,
          "/api/collections/progression_enrollments/records",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              progression,
              student,
              status: "active",
              released: progressionRecord.selfPaced === true,
              ...(firstStep ? { currentStep: firstStep } : {}),
            }),
            errorMessage: "We could not finish every assignment.",
          },
        );
        assigned++;
      }
    }
    return json({ assigned, skipped });
  } catch (caught) {
    const failure = pocketBaseError(caught, "We could not finish every assignment.");
    return json({ message: failure.message, assigned, skipped }, { status: failure.status });
  }
}
