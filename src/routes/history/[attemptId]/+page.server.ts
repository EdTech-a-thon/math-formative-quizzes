import { error, redirect } from "@sveltejs/kit";
import { answerFor, symbolFor, type Operation } from "$lib/quizProblems";

const pocketBaseUrl = "http://127.0.0.1:8090";

// Each response kept the operator it was sat with, so a quiz edited afterwards
// can never rewrite what this page says the questions were.
type Response = { top: number; bottom: number; op?: Operation; answer: string; correct: boolean };

export async function load({ cookies, params }) {
  const studentId = cookies.get("student_session");
  if (!studentId) redirect(303, "/");

  const response = await globalThis.fetch(`${pocketBaseUrl}/api/fact-friends/attempt-review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId, attemptId: params.attemptId }),
  });
  // Not their quiz, or a path that keeps the answers back.
  if (!response.ok) error(404, "This quiz is not one you can look back at.");

  const attempt = await response.json();
  const responses = (Array.isArray(attempt.responses) ? attempt.responses : []) as Response[];

  return {
    attempt: {
      title: attempt.title as string,
      icon: (attempt.icon || "") as string,
      shade: (attempt.shade || "") as string,
      progressionName: attempt.progressionName as string,
      correct: attempt.correct as number,
      total: attempt.total as number,
      passed: attempt.passed as boolean,
      completedAt: attempt.completedAt as string,
      questions: responses.map((item, index) => {
        const op = (item.op ?? "multiplication") as Operation;
        return {
          number: index + 1,
          top: item.top,
          bottom: item.bottom,
          symbol: symbolFor(op),
          answer: item.answer,
          correct: item.correct,
          correctAnswer: answerFor({ op, top: item.top, bottom: item.bottom }),
        };
      }),
    },
  };
}
