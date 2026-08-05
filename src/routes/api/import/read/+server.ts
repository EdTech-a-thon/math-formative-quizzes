import { error, json } from "@sveltejs/kit";
import { readEnvelope } from "$lib/server/exportRecord";
import { FAILURE_MESSAGES, NOT_OURS } from "$lib/server/importMessages";
import { recordFromUpload } from "$lib/server/importSource";

const MAX_BYTES = 20 * 1024 * 1024;

// Reads a dropped file or pasted text and hands back what it holds, without
// saving anything. The import dialog uses this to show what is in a file before
// any of it exists, and the quiz editor uses it to lift questions into the quiz
// being written.
export async function POST({ request, cookies }) {
  if (!cookies.get("teacher_session")) error(401, "Please sign in again.");

  const form = await request.formData();
  const file = form.get("file");
  const pasted = form.get("text");

  let bytes: Uint8Array;
  if (file instanceof File) {
    if (!file.size) return json({ message: "That file is empty.", detail: "Nothing was uploaded — try choosing the file again." }, { status: 400 });
    if (file.size > MAX_BYTES) {
      return json(
        { message: "That file is too big to import.", detail: `The limit is 20 MB and this one is ${(file.size / 1024 / 1024).toFixed(1)} MB.` },
        { status: 400 },
      );
    }
    bytes = new Uint8Array(await file.arrayBuffer());
  } else if (typeof pasted === "string" && pasted.trim()) {
    bytes = new TextEncoder().encode(pasted);
  } else {
    return json({ message: "Nothing to read.", detail: "Drop a file, choose one, or paste a copied quiz." }, { status: 400 });
  }

  const extracted = await recordFromUpload(bytes);
  if (!extracted.ok) return json(FAILURE_MESSAGES[extracted.reason], { status: 400 });

  const parsed = readEnvelope(extracted.record);
  if (!parsed) return json(NOT_OURS, { status: 400 });

  // The whole record goes back, so the dialog can show every quiz inside a
  // progression and let each one be kept or dropped.
  return json(parsed);
}
