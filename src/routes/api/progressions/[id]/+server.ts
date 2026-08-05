import { error, json } from "@sveltejs/kit";
import { appearanceOf } from "$lib/server/appearance";

const pocketBaseUrl = "http://127.0.0.1:8090";

type Step = { id: string; quiz: string; position: number };

export async function PATCH({ request, cookies, params }) {
  const token = cookies.get("teacher_session");
  if (!token) error(401, "Please sign in again.");
  const body = await request.json();
  if (!String(body.name || "").trim() || !Array.isArray(body.quizIds) || !body.quizIds.length)
    return json({ message: "Add a name and at least one quiz." }, { status: 400 });

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const update = await fetch(`${pocketBaseUrl}/api/collections/progressions/records/${params.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ name: body.name.trim(), description: String(body.description || "").trim(), passPercentage: Number(body.passPercentage) || 80, ...appearanceOf(body) }),
  });
  const progression = await update.json().catch(() => ({}));
  if (!update.ok) return json({ message: progression.message || "We could not save this progression." }, { status: update.status });

  const stepsResponse = await fetch(
    `${pocketBaseUrl}/api/collections/progression_steps/records?perPage=500&filter=${encodeURIComponent(`progression="${params.id}"`)}`,
    { headers },
  );
  if (!stepsResponse.ok) return json({ message: "The progression was saved, but its steps could not be read." }, { status: 500 });
  const existing: Step[] = (await stepsResponse.json()).items;

  // Reuse the step records for quizzes that are staying put. Deleting a step
  // cascades away every recorded attempt against it, so only steps the teacher
  // actually removed from the path are deleted.
  const quizIds: string[] = body.quizIds;
  const keep = new Map<string, Step>();
  const remove: Step[] = [];
  for (const step of existing) {
    if (quizIds.includes(step.quiz) && !keep.has(step.quiz)) keep.set(step.quiz, step);
    else remove.push(step);
  }

  const stepRequest = (path: string, init: RequestInit) => fetch(`${pocketBaseUrl}${path}`, { ...init, headers });
  for (const step of remove) {
    const response = await stepRequest(`/api/collections/progression_steps/records/${step.id}`, { method: "DELETE" });
    if (!response.ok) return json({ message: "The progression was saved, but a removed step could not be deleted." }, { status: 500 });
  }

  // (progression, position) is unique, so park the survivors above the range
  // before writing their final positions — otherwise a reorder collides with a
  // position that is still held by another step.
  const parked = existing.length + quizIds.length;
  for (const [index, step] of [...keep.values()].entries()) {
    const response = await stepRequest(`/api/collections/progression_steps/records/${step.id}`, { method: "PATCH", body: JSON.stringify({ position: parked + index + 1 }) });
    if (!response.ok) return json({ message: "The progression was saved, but its steps could not be reordered." }, { status: 500 });
  }

  for (const [index, quiz] of quizIds.entries()) {
    const step = keep.get(quiz);
    const response = step
      ? await stepRequest(`/api/collections/progression_steps/records/${step.id}`, { method: "PATCH", body: JSON.stringify({ position: index + 1 }) })
      : await stepRequest(`/api/collections/progression_steps/records`, { method: "POST", body: JSON.stringify({ progression: params.id, quiz, position: index + 1 }) });
    if (!response.ok) return json({ message: "The progression was saved, but a step could not be updated." }, { status: 500 });
  }

  return json(progression);
}
