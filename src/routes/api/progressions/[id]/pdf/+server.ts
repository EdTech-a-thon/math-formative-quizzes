import { error } from "@sveltejs/kit";
import { readProgressionRecord, type QuizRecord } from "$lib/server/exportRecord";
import { renderProgressionPdf } from "$lib/server/quizPdf";
import { pdfResponse, pocketBaseUrl } from "$lib/server/pdfResponse";

type Step = { quiz: string; position: number; expand?: { quiz?: { data?: unknown } } };

export async function GET({ cookies, params }) {
  const token = cookies.get("teacher_session");
  if (!token) error(401, "Please sign in again.");
  const headers = { Authorization: `Bearer ${token}` };

  const filter = encodeURIComponent(`progression="${params.id}"`);
  const [progressionResponse, stepsResponse] = await Promise.all([
    fetch(`${pocketBaseUrl}/api/collections/progressions/records/${params.id}`, { headers }),
    fetch(`${pocketBaseUrl}/api/collections/progression_steps/records?perPage=500&sort=position&expand=quiz&filter=${filter}`, { headers }),
  ]);
  if (!progressionResponse.ok) error(progressionResponse.status === 404 ? 404 : 500, "We could not find that progression.");
  if (!stepsResponse.ok) error(500, "We could not read this progression's steps.");

  const progression = await progressionResponse.json();
  // Step order is the whole point of a progression, so it carries through here.
  const steps: Step[] = (await stepsResponse.json()).items;
  const quizzes = steps.map((step) => step.expand?.quiz?.data).filter(Boolean);

  const record = readProgressionRecord({ ...progression, quizzes: quizzes as QuizRecord[] });
  if (!record) error(400, "That progression has no quizzes to export yet.");

  return pdfResponse(await renderProgressionPdf(record), record.name);
}
