import { error, json } from "@sveltejs/kit";

const pocketBaseUrl = "http://127.0.0.1:8090";

function auth(cookies: { get(name: string): string | undefined }) {
  const token = cookies.get("teacher_session");
  if (!token) error(401, "Please sign in again.");
  return `Bearer ${token}`;
}

export async function POST({ request, cookies }) {
  const authorization = auth(cookies);
  const body = await request.json();
  if (!body.progression || !body.student)
    return json({ message: "Pick a student and a progression." }, { status: 400 });

  // Start the student on the progression's first step.
  const stepsResponse = await fetch(
    `${pocketBaseUrl}/api/collections/progression_steps/records?perPage=1&sort=position&filter=progression%3D%22${body.progression}%22`,
    { headers: { Authorization: authorization } },
  );
  const steps = await stepsResponse.json().catch(() => ({ items: [] }));
  const firstStep = steps.items?.[0]?.id as string | undefined;

  const response = await fetch(`${pocketBaseUrl}/api/collections/progression_enrollments/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authorization },
    body: JSON.stringify({
      progression: body.progression,
      student: body.student,
      status: "active",
      ...(firstStep ? { currentStep: firstStep } : {}),
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return json({ message: result.message || "We could not assign this student." }, { status: response.status });
  return json(result);
}
