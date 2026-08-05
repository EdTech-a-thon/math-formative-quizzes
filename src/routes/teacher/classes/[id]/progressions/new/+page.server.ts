import { error } from "@sveltejs/kit";

const pocketBaseUrl = "http://127.0.0.1:8090";

export async function load({ cookies, params }) {
  const response = await globalThis.fetch(
    `${pocketBaseUrl}/api/collections/quizzes/records?perPage=500`,
    { headers: { Authorization: `Bearer ${cookies.get("teacher_session")}` } },
  );
  if (!response.ok) error(500, "We could not load this class's quizzes.");
  const quizzes = await response.json();
  return { quizzes: quizzes.items.filter((quiz: { class: string }) => quiz.class === params.id) };
}
