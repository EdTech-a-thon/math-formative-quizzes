import { pocketBaseUrl, teacherAuthorization } from "$lib/server/pocketbase";
import { redirect } from "@sveltejs/kit";

export async function load({ locals, cookies }) {
  if (!locals.teacher) redirect(303, "/teacher");
  // PocketBase's access rules narrow this to her own classes, so the count is
  // how many she already has.
  const classesResponse = await globalThis.fetch(`${pocketBaseUrl}/api/collections/classes/records?perPage=1&fields=id`, {
    headers: { Authorization: teacherAuthorization(cookies) },
  });
  const classes = classesResponse.ok ? await classesResponse.json() : { totalItems: 0 };
  return { defaultClassName: `Class ${classes.totalItems + 1}` };
}
