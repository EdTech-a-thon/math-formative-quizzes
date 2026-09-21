import { error } from "@sveltejs/kit";
import { readProgressionRecord, type QuizRecord } from "$lib/server/exportRecord";
import { pocketBaseError, teacherPocketBaseRequest } from "$lib/server/pocketbase";
import { renderProgressionPdf } from "$lib/server/quizPdf";
import { pdfResponse } from "$lib/server/pdfResponse";

type Step = { quiz: string; position: number; expand?: { quiz?: { data?: unknown } } };
type Progression = Record<string, unknown>;
type Items<T> = { items: T[] };

export async function GET({ cookies, params }) {
  const filter = encodeURIComponent(`progression="${params.id}"`);
  const [progressionResult, stepsResult] = await Promise.allSettled([
    teacherPocketBaseRequest<Progression>(
      cookies,
      `/api/collections/progressions/records/${params.id}`,
      { errorMessage: "We could not find that progression." },
    ),
    teacherPocketBaseRequest<Items<Step>>(
      cookies,
      `/api/collections/progression_steps/records?perPage=500&sort=position&expand=quiz&filter=${filter}`,
      { errorMessage: "We could not read this progression's steps." },
    ),
  ]);
  if (progressionResult.status === "rejected") {
    const failure = pocketBaseError(progressionResult.reason, "We could not find that progression.");
    error(failure.status === 404 ? 404 : 500, "We could not find that progression.");
  }
  if (stepsResult.status === "rejected") {
    error(500, "We could not read this progression's steps.");
  }
  const progression = progressionResult.value;
  const steps = stepsResult.value;

  // Step order is the whole point of a progression, so it carries through here.
  const quizzes = steps.items.map((step) => step.expand?.quiz?.data).filter(Boolean);
  const record = readProgressionRecord({ ...progression, quizzes: quizzes as QuizRecord[] });
  if (!record) error(400, "That progression has no quizzes to export yet.");

  return pdfResponse(await renderProgressionPdf(record), record.name);
}
