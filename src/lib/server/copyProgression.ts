import { pocketBaseRequest } from "$lib/server/pocketbase";

// Reusing a learning path in a new class must not mint new quizzes. The new
// class gets its own path record — paths stay per class, so each class keeps
// its own passing score, pacing and student progress — but its steps point at
// the very same quiz records the old path used. That is what stops a teacher
// ending up with one copy of every quiz per class.
//
// See docs/adr/0001-quizzes-belong-to-the-teacher.md.

type SourceProgression = {
  id: string;
  name: string;
  description?: string;
  passPercentage?: number;
  oneAtATime?: boolean;
  showAnswers?: boolean;
  operation?: string;
  icon?: string;
  shade?: string;
};

type SourceStep = { quiz: string; position: number };

function request<T>(authorization: string, path: string, init: RequestInit, errorMessage: string) {
  return pocketBaseRequest<T>(path, {
    ...init,
    errorMessage,
    headers: { "Content-Type": "application/json", Authorization: authorization, ...init.headers },
  });
}

// Reading through the teacher's own session means PocketBase's access rules
// decide what she may copy: a path belonging to somebody else is simply not
// found.
async function readSource(authorization: string, progressionId: string) {
  const progression = await request<SourceProgression>(
    authorization,
    `/api/collections/progressions/records/${progressionId}`,
    {},
    "We could not open one of the learning paths you chose.",
  );
  const steps = await request<{ items: SourceStep[] }>(
    authorization,
    `/api/collections/progression_steps/records?perPage=500&sort=position&filter=${encodeURIComponent(`progression="${progressionId}"`)}`,
    {},
    "We could not read the quizzes in one of the learning paths you chose.",
  );
  return { progression, steps: steps.items };
}

export async function copyProgressionToClass(
  authorization: string,
  progressionId: string,
  target: { classId: string; selfPaced: boolean },
): Promise<{ id: string; quizCount: number }> {
  const { progression, steps } = await readSource(authorization, progressionId);

  // Everything about how the path is sat comes across, except the pacing: the
  // teacher just answered that question on the setup screen, so her answer wins.
  const copy = await request<{ id: string }>(
    authorization,
    "/api/collections/progressions/records",
    {
      method: "POST",
      body: JSON.stringify({
        class: target.classId,
        name: progression.name,
        description: progression.description ?? "",
        passPercentage: progression.passPercentage ?? 80,
        oneAtATime: progression.oneAtATime === true,
        showAnswers: progression.showAnswers === true,
        selfPaced: target.selfPaced,
        operation: progression.operation ?? "",
        icon: progression.icon ?? "",
        shade: progression.shade ?? "",
      }),
    },
    "We could not add one of the learning paths you chose.",
  );

  for (const [index, step] of steps.entries()) {
    await request(
      authorization,
      "/api/collections/progression_steps/records",
      {
        method: "POST",
        // step.quiz is the existing quiz's id, kept as it is on purpose.
        body: JSON.stringify({ progression: copy.id, quiz: step.quiz, position: index + 1 }),
      },
      "A learning path was added, but one of its quizzes could not be included.",
    );
  }

  return { id: copy.id, quizCount: steps.length };
}
