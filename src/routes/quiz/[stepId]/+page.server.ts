import { fail, redirect } from "@sveltejs/kit";
import { answerFor, buildProblems, type Operation, type StoredFactGroup } from "$lib/quizProblems";

const pocketBaseUrl = "http://127.0.0.1:8090";

type QuizStep = {
  quiz: { title: string; operation: Operation; factGroups: StoredFactGroup[]; questionCount: number; timeLimitMinutes: number; showScore: boolean; passMessage: string };
  progressionName: string;
  position: number;
  totalSteps: number;
  passPercentage: number;
  allowIncompleteAnswers: boolean;
};

async function pocketBasePost(path: string, payload: unknown) {
  const response = await globalThis.fetch(`${pocketBaseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, body };
}

// Handing in a passing quiz moves the student on, so the step they just sat is
// no longer open to them. This stands in while their results are on screen.
const finishedSheet = {
  quiz: { title: "", operation: "multiplication" as Operation, factGroups: [] as StoredFactGroup[], questionCount: 0, timeLimitMinutes: 0, showScore: true, passMessage: "" },
  progressionName: "",
  position: 0,
  totalSteps: 0,
  passPercentage: 0,
  allowIncompleteAnswers: true,
};

export async function load({ cookies, params, request }) {
  const studentId = cookies.get("student_session");
  if (!studentId) redirect(303, "/");

  const { ok, body } = await pocketBasePost("/api/fact-friends/quiz-step", { studentId, stepId: params.stepId });
  // Not their quiz, or they have already moved past it.
  if (!ok) {
    if (request.method === "POST") return { ...finishedSheet, seed: 0 };
    redirect(303, "/home");
  }

  // One shuffle per sitting. The same seed rebuilds the same worksheet when the
  // answers come back, so marking lines up with what the student saw.
  return { ...(body as QuizStep), seed: Math.floor(Math.random() * 1_000_000_000) };
}

export const actions = {
  default: async ({ cookies, params, request }) => {
    const studentId = cookies.get("student_session");
    if (!studentId) redirect(303, "/");

    const data = await request.formData();
    const seed = Number(data.get("seed") ?? 0);
    const secondsRemaining = Math.max(0, Number(data.get("secondsRemaining") ?? 0));

    // Rebuild the worksheet from the teacher's quiz rather than trusting the
    // questions or the marking to the browser.
    const reopened = await pocketBasePost("/api/fact-friends/quiz-step", { studentId, stepId: params.stepId });
    if (!reopened.ok) redirect(303, "/home");
    const step = reopened.body as QuizStep;
    const operation = step.quiz.operation;
    const problems = buildProblems(operation, step.quiz.factGroups, { cap: step.quiz.questionCount || undefined, seed });

    let correct = 0;
    const responses = problems.map((problem, index) => {
      const typed = String(data.get(`answer-${index}`) ?? "").trim();
      const right = typed !== "" && Number(typed) === answerFor(problem, operation);
      if (right) correct += 1;
      return { top: problem.top, bottom: problem.bottom, answer: typed, correct: right };
    });

    const recorded = await pocketBasePost("/api/fact-friends/record-attempt", {
      studentId,
      stepId: params.stepId,
      correct,
      total: problems.length,
      secondsRemaining,
      responses,
    });
    if (!recorded.ok) return fail(400, { error: recorded.body.message || "We could not hand in this quiz." });

    // The results screen reads these from the hand-in, because a student who
    // passed can no longer open the step they just finished.
    return {
      finished: true,
      ...(recorded.body as { correct: number; total: number; percentage: number; passed: boolean; leveledUp: boolean; finishedProgression: boolean }),
      showScore: step.quiz.showScore,
      passMessage: step.quiz.passMessage,
      operation,
      progressionName: step.progressionName,
      position: step.position,
      totalSteps: step.totalSteps,
    };
  },
};
