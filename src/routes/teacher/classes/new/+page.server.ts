import { redirect } from "@sveltejs/kit";

export async function load({ locals, cookies }) {
  if (!locals.teacher) redirect(303, "/teacher");
  const token = cookies.get("teacher_session");
  const response = await globalThis.fetch("http://127.0.0.1:8090/api/collections/classes/records?perPage=1", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = response.ok ? await response.json() : { totalItems: 0 };
  return { defaultClassName: `Class ${result.totalItems + 1}` };
}
