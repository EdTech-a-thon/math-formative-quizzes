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

// `starter` marks one of the ready-made quizzes in her library; see
// $lib/server/starterPaths.
async function saveQuiz(authorization: string, teacherId: string, quiz: QuizRecord, starter = ""): Promise<string> {
  const saved = await request<{ id: string }>(
    authorization,
    "/api/collections/quizzes/records",
    {
      method: "POST",
      body: JSON.stringify({
        teacher: teacherId,
        starter,
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
  await savePathOfQuizzes(authorization, owner.classId, progression, quizIds);
  onSaved?.progression?.();
  return quizIds.length;
}

// A path whose quizzes are already in her library: only the path and its steps
// are written, pointing at those quizzes in the order given.
export async function savePathOfQuizzes(authorization: string, classId: string, progression: Omit<ProgressionRecord, "quizzes">, quizIds: string[]) {
  const saved = await request<{ id: string }>(
    authorization,
    "/api/collections/progressions/records",
    {
      method: "POST",
      body: JSON.stringify({
        class: classId,
        name: progression.name,
        description: progression.description,
        passPercentage: progression.passPercentage,
        oneAtATime: progression.oneAtATime,
        showAnswers: progression.showAnswers,
        selfPaced: progression.selfPaced,
        ...appearanceOf(progression),
      }),
    },
    "We could not save a learning path.",
  );

  for (const [index, quizId] of quizIds.entries()) {
    await request(
      authorization,
      "/api/collections/progression_steps/records",
      {
        method: "POST",
        body: JSON.stringify({ progression: saved.id, quiz: quizId, position: index + 1 }),
      },
      "A learning path was saved, but one of its quizzes could not be added.",
    );
  }
}

export { saveQuiz };
