import { error, redirect } from "@sveltejs/kit";

import { pocketBaseUrl, teacherAuthorization } from "$lib/server/pocketbase";

export async function load({ locals, cookies, params }) {
  if (!locals.teacher) redirect(303, "/teacher");

  const response = await globalThis.fetch(
    `${pocketBaseUrl}/api/collections/classes/records/${params.id}`,
    { headers: { Authorization: teacherAuthorization(cookies) } },
  );
  if (response.status === 404) error(404, "Class not found.");
  if (!response.ok) error(500, "We could not load this class.");
  return { classRoom: await response.json() };
}
