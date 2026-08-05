import { redirect } from "@sveltejs/kit";

export function load({ locals }) {
  if (locals.teacher) redirect(303, "/teacher/home");
}
