import { error, json } from "@sveltejs/kit";

const pocketBaseUrl = "http://127.0.0.1:8090";

export async function POST({ request, cookies }) {
  const token = cookies.get("teacher_session");
  if (!token) error(401, "Please sign in again.");
  const body = await request.json();
  if (!body.class || !String(body.name || "").trim() || !Array.isArray(body.quizIds) || !body.quizIds.length)
    return json({ message: "Add a name and at least one quiz." }, { status: 400 });

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const create = await fetch(`${pocketBaseUrl}/api/collections/progressions/records`, {
    method: "POST",
    headers,
    body: JSON.stringify({ class: body.class, name: body.name.trim(), description: String(body.description || "").trim(), passPercentage: Number(body.passPercentage) || 80, status: "draft" }),
  });
  const progression = await create.json().catch(() => ({}));
  if (!create.ok) return json({ message: progression.message || "We could not save this progression." }, { status: create.status });

  for (const [index, quiz] of body.quizIds.entries()) {
    const step = await fetch(`${pocketBaseUrl}/api/collections/progression_steps/records`, {
      method: "POST", headers, body: JSON.stringify({ progression: progression.id, quiz, position: index + 1 }),
    });
    if (!step.ok) return json({ message: "The progression was saved, but a step could not be added." }, { status: 500 });
  }
  return json(progression);
}
