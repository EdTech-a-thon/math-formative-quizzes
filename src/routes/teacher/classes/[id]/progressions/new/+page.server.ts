import { error } from "@sveltejs/kit";

import { pocketBaseUrl, teacherAuthorization } from "$lib/server/pocketbase";

export async function load({ cookies, params }) {
  const response = await globalThis.fetch(
    `${pocketBaseUrl}/api/collections/quizzes/records?perPage=500`,
    { headers: { Authorization: teacherAuthorization(cookies) } },
  );
  if (!response.ok) error(500, "We could not load this class's quizzes.");
  const quizzes = await response.json();
  return { quizzes: quizzes.items.filter((quiz: { class: string }) => quiz.class === params.id) };
}
