import { error } from "@sveltejs/kit";

import { pocketBaseUrl, teacherAuthorization } from "$lib/server/pocketbase";

export async function load({ cookies, params }) {
  const response = await globalThis.fetch(
    `${pocketBaseUrl}/api/collections/quizzes/records/${params.quizId}`,
    { headers: { Authorization: teacherAuthorization(cookies) } },
  );
  if (response.status === 404) error(404, "Quiz not found.");
  if (!response.ok) error(500, "We could not load this quiz.");
  const quiz = await response.json();
  if (quiz.class !== params.id) error(404, "Quiz not found.");
  return { quiz };
}
