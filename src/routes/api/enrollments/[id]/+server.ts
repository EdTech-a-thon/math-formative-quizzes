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

export async function PATCH({ cookies, params }) {
  const authorization = auth(cookies);
  const currentResponse = await fetch(`${pocketBaseUrl}/api/collections/progression_enrollments/records/${params.id}?fields=status,released`, {
    headers: { Authorization: authorization },
  });
  const current = await currentResponse.json().catch(() => ({}));
  if (!currentResponse.ok) return json({ message: current.message || "We could not find this assignment." }, { status: currentResponse.status });
  if (current.status === "completed") return json({ message: "This progression is already complete." }, { status: 400 });
  if (current.released) return json({ released: true });

  const response = await fetch(`${pocketBaseUrl}/api/collections/progression_enrollments/records/${params.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: authorization },
    body: JSON.stringify({ released: true }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return json({ message: result.message || "We could not release this attempt." }, { status: response.status });
  return json({ released: true });
}
