import { error, json } from "@sveltejs/kit";
import { readEnvelope } from "$lib/server/exportRecord";
import { FAILURE_MESSAGES, NOT_OURS } from "$lib/server/importMessages";
import { recordFromUpload } from "$lib/server/importSource";

const MAX_BYTES = 20 * 1024 * 1024;

// Reads a PDF or a JSON record and hands back the questions it carries without
// saving anything. The quiz editor uses this to pull questions into the quiz
// being written, rather than creating a separate one the way the library does.
export async function POST({ request, cookies }) {
  if (!cookies.get("teacher_session")) error(401, "Please sign in again.");

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ message: "No file was chosen.", detail: "Pick a PDF or a JSON file to import." }, { status: 400 });
  if (!file.size) return json({ message: "That file is empty.", detail: "Nothing was uploaded — try choosing the file again." }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return json(
      { message: "That file is too big to import.", detail: `The limit is 20 MB and this one is ${(file.size / 1024 / 1024).toFixed(1)} MB.` },
      { status: 400 },
    );
  }

  const extracted = await recordFromUpload(new Uint8Array(await file.arrayBuffer()));
  if (!extracted.ok) return json(FAILURE_MESSAGES[extracted.reason], { status: 400 });

  const parsed = readEnvelope(extracted.record);
  if (!parsed) return json(NOT_OURS, { status: 400 });

  // A progression is a series of quizzes, so importing one into a single quiz
  // takes every question it holds, in order.
  const problems = parsed.kind === "quiz" ? parsed.quiz.problems : parsed.progression.quizzes.flatMap((quiz) => quiz.problems);
  const title = parsed.kind === "quiz" ? parsed.quiz.title : parsed.progression.name;
  return json({ kind: parsed.kind, title, problems });
}
