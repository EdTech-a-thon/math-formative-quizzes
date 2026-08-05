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
  if (!body.progression) return json({ message: "Choose a progression to release." }, { status: 400 });

  const filter = encodeURIComponent(`progression="${body.progression}" && status="active" && released=false`);
  const response = await fetch(
    `${pocketBaseUrl}/api/collections/progression_enrollments/records?perPage=2000&fields=id&filter=${filter}`,
    { headers: { Authorization: authorization } },
  );
  const result = await response.json().catch(() => ({ items: [] }));
  if (!response.ok) return json({ message: result.message || "We could not find the students waiting for release." }, { status: response.status });

  let released = 0;
  for (const enrollment of result.items ?? []) {
    const update = await fetch(`${pocketBaseUrl}/api/collections/progression_enrollments/records/${enrollment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: authorization },
      body: JSON.stringify({ released: true }),
    });
    if (!update.ok) return json({ message: "Some students were released, but we could not release everyone.", released }, { status: 500 });
    released++;
  }
  return json({ released });
}
