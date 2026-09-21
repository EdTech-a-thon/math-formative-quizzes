import { pocketBaseUrl, teacherAuthorization } from "$lib/server/pocketbase";
import { redirect } from "@sveltejs/kit";

export async function load({ locals, cookies }) {
  if (!locals.teacher) redirect(303, "/teacher");
  const authorization = teacherAuthorization(cookies);
  const response = await globalThis.fetch(`${pocketBaseUrl}/api/collections/classes/records?perPage=1`, {
    headers: { Authorization: authorization },
  });
  const result = response.ok ? await response.json() : { totalItems: 0 };
  return { defaultClassName: `Class ${result.totalItems + 1}` };
}
