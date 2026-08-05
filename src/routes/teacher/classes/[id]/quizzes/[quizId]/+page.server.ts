import { error } from "@sveltejs/kit";

const pocketBaseUrl = "http://127.0.0.1:8090";

export async function load({ cookies, params }) {
  const response = await globalThis.fetch(
    `${pocketBaseUrl}/api/collections/quizzes/records/${params.quizId}`,
    { headers: { Authorization: `Bearer ${cookies.get("teacher_session")}` } },
  );
  if (response.status === 404) error(404, "Quiz not found.");
  if (!response.ok) error(500, "We could not load this quiz.");
  const quiz = await response.json();
  if (quiz.class !== params.id) error(404, "Quiz not found.");
  return { quiz };
}
