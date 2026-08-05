import { error } from "@sveltejs/kit";
import { answerFor, symbolFor, type Operation } from "$lib/quizProblems";

const pocketBaseUrl = "http://127.0.0.1:8090";

// Each response records the operator it was sat with, so editing the quiz
// afterwards can never rewrite what this report says the questions were.
type Response = { top: number; bottom: number; op?: Operation; answer: string; correct: boolean };

export async function load({ cookies, params }) {
  const headers = { Authorization: `Bearer ${cookies.get("teacher_session")}` };
  const [studentResponse, attemptResponse] = await Promise.all([
    globalThis.fetch(`${pocketBaseUrl}/api/collections/students/records/${params.studentId}`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/quiz_attempts/records/${params.attemptId}?expand=quiz,progressionStep,progressionEnrollment.progression`, { headers }),
  ]);

  if (studentResponse.status === 404 || attemptResponse.status === 404) error(404, "Attempt not found.");
  if (!studentResponse.ok || !attemptResponse.ok) error(500, "We could not load this attempt.");
  const student = await studentResponse.json();
  const attempt = await attemptResponse.json();
  if (student.class !== params.id || attempt.student !== params.studentId || attempt.expand?.quiz?.class !== params.id) error(404, "Attempt not found.");

  const quiz = attempt.expand?.quiz?.data ?? {};
  const responses = (Array.isArray(attempt.responses) ? attempt.responses : []) as Response[];

  return {
    student: { id: student.id, name: student.name },
    attempt: {
      id: attempt.id,
      title: quiz.title || "Quiz",
      progressionName: attempt.expand?.progressionEnrollment?.expand?.progression?.name ?? "",
      position: attempt.expand?.progressionStep?.position ?? null,
      correct: attempt.correct,
      total: attempt.total,
      passed: attempt.passed,
      leveledUp: attempt.leveledUp,
      completedAt: attempt.completedAt,
      responses: responses.map((response, index) => {
        const op = (response.op ?? "multiplication") as Operation;
        return {
          number: index + 1,
          top: response.top,
          bottom: response.bottom,
          symbol: symbolFor(op),
          submitted: response.answer,
          correct: response.correct,
          correctAnswer: answerFor({ op, top: response.top, bottom: response.bottom }),
        };
      }),
    },
  };
}
