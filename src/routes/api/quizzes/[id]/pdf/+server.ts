import { error } from "@sveltejs/kit";
import { readQuizRecord } from "$lib/server/exportRecord";
import { pocketBaseError, teacherPocketBaseRequest } from "$lib/server/pocketbase";
import { renderQuizPdf } from "$lib/server/quizPdf";
import { pdfResponse } from "$lib/server/pdfResponse";

type Quiz = { data?: unknown };

export async function GET({ cookies, params }) {
  let quiz: Quiz;
  try {
    quiz = await teacherPocketBaseRequest<Quiz>(
      cookies,
      `/api/collections/quizzes/records/${params.id}`,
      { errorMessage: "We could not find that quiz." },
    );
  } catch (caught) {
    const failure = pocketBaseError(caught, "We could not find that quiz.");
    error(failure.status === 404 ? 404 : 500, "We could not find that quiz.");
  }

  const record = readQuizRecord(quiz.data);
  if (!record) error(400, "That quiz has no questions to export yet.");

  return pdfResponse(await renderQuizPdf(record), record.title);
}
