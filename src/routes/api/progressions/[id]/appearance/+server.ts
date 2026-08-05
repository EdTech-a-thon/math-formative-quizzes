import { error, json } from "@sveltejs/kit";
import { appearanceOf } from "$lib/server/appearance";

const pocketBaseUrl = "http://127.0.0.1:8090";

// Just the icon and colour, so the progressions list can change how a path
// looks without sending its name, score and steps back through the full save.
export async function PATCH({ request, cookies, params }) {
  const token = cookies.get("teacher_session");
  if (!token) error(401, "Please sign in again.");

  const response = await fetch(`${pocketBaseUrl}/api/collections/progressions/records/${params.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(appearanceOf(await request.json())),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return json({ message: result.message || "We could not update this progression." }, { status: response.status });
  return json(result);
}
