import { json } from "@sveltejs/kit";
import { pocketBaseError, teacherPocketBaseRequest } from "$lib/server/pocketbase";

type Items = { items?: { id: string }[] };

export async function POST({ request, cookies }) {
  const body = await request.json();
  if (!body.progression) return json({ message: "Choose a progression to release." }, { status: 400 });

  let released = 0;
  try {
    const filter = encodeURIComponent(`progression="${body.progression}" && status="active" && released=false`);
    const result = await teacherPocketBaseRequest<Items>(
      cookies,
      `/api/collections/progression_enrollments/records?perPage=2000&fields=id&filter=${filter}`,
      { errorMessage: "We could not find the students waiting for release." },
    );

    for (const enrollment of result.items ?? []) {
      await teacherPocketBaseRequest(
        cookies,
        `/api/collections/progression_enrollments/records/${enrollment.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ released: true }),
          errorMessage: "Some students are ready, but we could not release everyone.",
          preferErrorMessage: true,
        },
      );
      released++;
    }
    return json({ released });
  } catch (caught) {
    const failure = pocketBaseError(caught, "Some students are ready, but we could not release everyone.");
    return json({ message: failure.message, released }, { status: failure.status });
  }
}
