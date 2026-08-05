import { error } from "@sveltejs/kit";
import { readQuizRecord } from "$lib/server/exportRecord";
import { renderQuizPdf } from "$lib/server/quizPdf";
import { pdfResponse, pocketBaseUrl } from "$lib/server/pdfResponse";

export async function GET({ cookies, params }) {
  const token = cookies.get("teacher_session");
  if (!token) error(401, "Please sign in again.");

  const response = await fetch(`${pocketBaseUrl}/api/collections/quizzes/records/${params.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) error(response.status === 404 ? 404 : 500, "We could not find that quiz.");

  const record = readQuizRecord((await response.json()).data);
  if (!record) error(400, "That quiz has no questions to export yet.");

  return pdfResponse(await renderQuizPdf(record), record.title);
}
