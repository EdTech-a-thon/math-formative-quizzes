import { error, json } from "@sveltejs/kit";

const pocketBaseUrl = "http://127.0.0.1:8090";

function auth(cookies: { get(name: string): string | undefined }) {
  const token = cookies.get("teacher_session");
  if (!token) error(401, "Please sign in again.");
  return `Bearer ${token}`;
}

function idList(value: unknown, single: unknown) {
  const list = Array.isArray(value) ? value : [single];
  return [...new Set(list.filter((id: unknown): id is string => typeof id === "string" && Boolean(id)))];
}

// Every assignment in the app comes through here: any number of students onto
// any number of progressions. Pairs that already exist are left alone, so
// assigning twice never resets anybody's progress.
export async function POST({ request, cookies }) {
  const authorization = auth(cookies);
  const body = await request.json();
  const students = idList(body.students, body.student);
  const progressions = idList(body.progressions, body.progression);
  if (!progressions.length || !students.length)
    return json({ message: "Pick at least one student and one progression." }, { status: 400 });

  const headers = { "Content-Type": "application/json", Authorization: authorization };
  let assigned = 0;
  let skipped = 0;

  for (const progression of progressions) {
    // Start each new student on this progression's first step.
    const stepsResponse = await fetch(
      `${pocketBaseUrl}/api/collections/progression_steps/records?perPage=1&sort=position&filter=progression%3D%22${progression}%22`,
      { headers: { Authorization: authorization } },
    );
    const steps = await stepsResponse.json().catch(() => ({ items: [] }));
    const firstStep = steps.items?.[0]?.id as string | undefined;

    const existingResponse = await fetch(
      `${pocketBaseUrl}/api/collections/progression_enrollments/records?perPage=1000&fields=student&filter=progression%3D%22${progression}%22`,
      { headers: { Authorization: authorization } },
    );
    const existing = await existingResponse.json().catch(() => ({ items: [] }));
    const alreadyOn = new Set<string>((existing.items ?? []).map((item: { student: string }) => item.student));

    for (const student of students) {
      if (alreadyOn.has(student)) {
        skipped++;
        continue;
      }
      const response = await fetch(`${pocketBaseUrl}/api/collections/progression_enrollments/records`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          progression,
          student,
          status: "active",
          released: false,
          ...(firstStep ? { currentStep: firstStep } : {}),
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        return json({ message: result.message || "We could not finish every assignment.", assigned, skipped }, { status: response.status });
      }
      assigned++;
    }
  }

  return json({ assigned, skipped });
}
