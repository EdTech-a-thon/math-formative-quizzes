import { appearanceOf } from "$lib/server/appearance";
import { pocketBaseUrl } from "$lib/server/pdfResponse";
import type { ProgressionRecord, QuizRecord } from "$lib/server/exportRecord";

async function saveQuiz(headers: Record<string, string>, classId: string, quiz: QuizRecord): Promise<string> {
  const response = await fetch(`${pocketBaseUrl}/api/collections/quizzes/records`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      class: classId,
      data: {
        title: quiz.title,
        problems: quiz.problems,
        timeLimitMinutes: quiz.timeLimitMinutes,
        showScore: quiz.showScore,
        passMessage: quiz.passMessage,
        ...appearanceOf(quiz),
      },
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "We could not save a quiz.");
  return body.id as string;
}

export async function saveProgression(headers: Record<string, string>, classId: string, progression: ProgressionRecord, onSaved?: { quiz?: () => void; progression?: () => void }): Promise<number> {
  const quizIds: string[] = [];
  for (const quiz of progression.quizzes) {
    quizIds.push(await saveQuiz(headers, classId, quiz));
    onSaved?.quiz?.();
  }

  const created = await fetch(`${pocketBaseUrl}/api/collections/progressions/records`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      class: classId,
      name: progression.name,
      description: progression.description,
      passPercentage: progression.passPercentage,
      oneAtATime: progression.oneAtATime,
      showAnswers: progression.showAnswers,
      ...appearanceOf(progression),
    }),
  });
  const saved = await created.json().catch(() => ({}));
  if (!created.ok) throw new Error(saved.message || "We could not save a practice path.");
  onSaved?.progression?.();

  for (const [index, quizId] of quizIds.entries()) {
    const step = await fetch(`${pocketBaseUrl}/api/collections/progression_steps/records`, {
      method: "POST",
      headers,
      body: JSON.stringify({ progression: saved.id, quiz: quizId, position: index + 1 }),
    });
    if (!step.ok) throw new Error("A practice path was saved, but one of its quizzes could not be added.");
  }
  return quizIds.length;
}

export { saveQuiz };
