import { error, json } from "@sveltejs/kit";

const pocketBaseUrl = "http://127.0.0.1:8090";

function auth(cookies: { get(name: string): string | undefined }) {
  const token = cookies.get("teacher_session");
  if (!token) error(401, "Please sign in again.");
  return `Bearer ${token}`;
}

export async function DELETE({ cookies, params }) {
  const response = await fetch(`${pocketBaseUrl}/api/collections/progression_enrollments/records/${params.id}`, {
    method: "DELETE",
    headers: { Authorization: auth(cookies) },
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    return json({ message: result.message || "We could not remove this assignment." }, { status: response.status });
  }
  return json({ ok: true });
}
