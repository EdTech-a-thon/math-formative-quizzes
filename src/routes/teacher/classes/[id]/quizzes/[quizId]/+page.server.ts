import { error } from "@sveltejs/kit";

import { pocketBaseUrl, teacherAuthorization } from "$lib/server/pocketbase";

export async function load({ cookies, params }) {
  const response = await globalThis.fetch(
    `${pocketBaseUrl}/api/collections/quizzes/records/${params.quizId}`,
    { headers: { Authorization: teacherAuthorization(cookies) } },
  );
  if (response.status === 404) error(404, "Quiz not found.");
  if (!response.ok) error(500, "We could not load this quiz.");
  // A quiz is the teacher's, not the class's, so PocketBase's access rules are
  // the whole ownership check: another teacher's quiz comes back as a 404.
  return { quiz: await response.json() };
}
