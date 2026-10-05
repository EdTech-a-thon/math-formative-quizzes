import { error } from "@sveltejs/kit";

import { pocketBaseUrl, teacherAuthorization } from "$lib/server/pocketbase";

export async function load({ cookies }) {
  const response = await globalThis.fetch(
    `${pocketBaseUrl}/api/collections/quizzes/records?perPage=500`,
    { headers: { Authorization: teacherAuthorization(cookies) } },
  );
  if (!response.ok) error(500, "We could not load this class's quizzes.");
  // The teacher's own quizzes are what a new learning path can be built from;
  // PocketBase's access rules already limit the list to hers.
  const quizzes = await response.json();
  return { quizzes: quizzes.items };
}
