import { appearanceOf } from "$lib/server/appearance";
import { pocketBaseRequest } from "$lib/server/pocketbase";
import type { ProgressionRecord, QuizRecord } from "$lib/server/exportRecord";

function request<T>(authorization: string, path: string, init: RequestInit, errorMessage: string) {
  return pocketBaseRequest<T>(path, {
    ...init,
    errorMessage,
    headers: { "Content-Type": "application/json", Authorization: authorization, ...init.headers },
  });
}

// A quiz belongs to the teacher and a learning path belongs to one of her
// classes, so saving a path needs both owners.
export type PathOwner = { teacherId: string; classId: string };

async function saveQuiz(authorization: string, teacherId: string, quiz: QuizRecord): Promise<string> {
  const saved = await request<{ id: string }>(
    authorization,
    "/api/collections/quizzes/records",
    {
      method: "POST",
      body: JSON.stringify({
        teacher: teacherId,
        data: {
          title: quiz.title,
          problems: quiz.problems,
          timeLimitSeconds: quiz.timeLimitSeconds,
          showScore: quiz.showScore,
          passMessage: quiz.passMessage,
          ...appearanceOf(quiz),
        },
      }),
    },
    "We could not save a quiz.",
  );
  return saved.id;
}

export async function saveProgression(authorization: string, owner: PathOwner, progression: ProgressionRecord, onSaved?: { quiz?: () => void; progression?: () => void }): Promise<number> {
  const quizIds: string[] = [];
  for (const quiz of progression.quizzes) {
    quizIds.push(await saveQuiz(authorization, owner.teacherId, quiz));
    onSaved?.quiz?.();
  }

  const saved = await request<{ id: string }>(
    authorization,
    "/api/collections/progressions/records",
    {
      method: "POST",
      body: JSON.stringify({
        class: owner.classId,
        name: progression.name,
        description: progression.description,
        passPercentage: progression.passPercentage,
        oneAtATime: progression.oneAtATime,
        showAnswers: progression.showAnswers,
        selfPaced: progression.selfPaced,
        ...appearanceOf(progression),
      }),
    },
    "We could not save a practice path.",
  );
  onSaved?.progression?.();

  for (const [index, quizId] of quizIds.entries()) {
    await request(
      authorization,
      "/api/collections/progression_steps/records",
      {
        method: "POST",
        body: JSON.stringify({ progression: saved.id, quiz: quizId, position: index + 1 }),
      },
      "A practice path was saved, but one of its quizzes could not be added.",
    );
  }
  return quizIds.length;
}

export { saveQuiz };
