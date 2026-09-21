import { json } from "@sveltejs/kit";
import { PocketBaseRequestError, pocketBaseRequest } from "$lib/server/pocketbase";

export async function POST({ request }) {
  const { classCode } = await request.json();
  try {
    const body = await pocketBaseRequest(
      "/api/fact-friends/class-code",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classCode }),
      },
    );
    return json(body);
  } catch (caught) {
    if (caught instanceof PocketBaseRequestError) {
      return json(caught.body, { status: caught.status });
    }
    return json({ message: "PocketBase request failed." }, { status: 500 });
  }
}
