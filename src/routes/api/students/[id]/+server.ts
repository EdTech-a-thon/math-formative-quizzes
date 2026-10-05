import { error, json } from "@sveltejs/kit";

const pocketBaseUrl = "http://127.0.0.1:8090";

function auth(cookies: { get(name: string): string | undefined }) {
  const token = cookies.get("teacher_session");
  if (!token) error(401, "Please sign in again.");
  return `Bearer ${token}`;
}

// Save one student's accommodations. Only the settings sent are changed, so a
// later accommodation can be saved without clearing extra time.
export async function PATCH({ cookies, params, request }) {
  const authorization = auth(cookies);
  const body = await request.json().catch(() => ({}));

  const currentResponse = await fetch(`${pocketBaseUrl}/api/collections/students/records/${params.id}?fields=accommodations`, {
    headers: { Authorization: authorization },
  });
  const current = await currentResponse.json().catch(() => ({}));
  if (!currentResponse.ok) return json({ message: current.message || "We could not find this student." }, { status: currentResponse.status });

  const accommodations = { ...(current.accommodations ?? {}) };
  if (body.extraTimeMinutes !== undefined) {
    accommodations.extraTimeMinutes = Math.min(60, Math.max(0, Math.round(Number(body.extraTimeMinutes)) || 0));
  }

  const response = await fetch(`${pocketBaseUrl}/api/collections/students/records/${params.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: authorization },
    body: JSON.stringify({ accommodations }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return json({ message: result.message || "We could not save these accommodations." }, { status: response.status });
  return json({ accommodations });
}

// Remove a student from their class. With `mergeIntoId`, their enrollments and
// attempts move to that student first (for a duplicate student); without it,
// their work is deleted with them.
export async function DELETE({ cookies, params, request }) {
  const authorization = auth(cookies);
  const body = await request.json().catch(() => ({}));

  const response = await fetch(`${pocketBaseUrl}/api/fact-friends/remove-student`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authorization },
    body: JSON.stringify({ studentId: params.id, mergeIntoId: String(body.mergeIntoId ?? "") }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return json({ message: result.message || "We could not remove this student." }, { status: response.status });
  return json({ ok: true });
}
