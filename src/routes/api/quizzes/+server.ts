import { error, json } from "@sveltejs/kit";

const pocketBaseUrl = "http://127.0.0.1:8090";

function auth(cookies: { get(name: string): string | undefined }) {
  const token = cookies.get("teacher_session");
  if (!token) error(401, "Please sign in again.");
  return `Bearer ${token}`;
}

export async function POST({ request, cookies }) {
  const body = await request.json();
  if (!body.class || !body.data?.title || !Array.isArray(body.data.factGroups) || !body.data.factGroups.length)
    return json({ message: "Add a title and at least one fact group." }, { status: 400 });

  const response = await fetch(`${pocketBaseUrl}/api/collections/quizzes/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth(cookies) },
    body: JSON.stringify({ class: body.class, data: body.data }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return json({ message: result.message || "We could not save this quiz." }, { status: response.status });
  return json(result);
}
