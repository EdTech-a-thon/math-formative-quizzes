import { json } from "@sveltejs/kit";
import { appearanceOf } from "$lib/server/appearance";
import { pocketBaseError, teacherPocketBaseRequest } from "$lib/server/pocketbase";

// Just the icon and colour, so the progressions list can change how a path
// looks without sending its name, score and steps back through the full save.
export async function PATCH({ request, cookies, params }) {
  try {
    const result = await teacherPocketBaseRequest(
      cookies,
      `/api/collections/progressions/records/${params.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appearanceOf(await request.json())),
        errorMessage: "We could not update this progression.",
      },
    );
    return json(result);
  } catch (caught) {
    const failure = pocketBaseError(caught, "We could not update this progression.");
    return json({ message: failure.message }, { status: failure.status });
  }
}
