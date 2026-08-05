import type { SourceFailure } from "$lib/server/importSource";

// Each failure gets its own wording, because "it did not work" leaves a teacher
// with nothing to try next.
export const FAILURE_MESSAGES: Record<SourceFailure, { message: string; detail: string }> = {
  "not-supported": {
    message: "That file could not be read.",
    detail: "Import a PDF from an Export button, or paste a copied quiz.",
  },
  "damaged-json": {
    message: "That JSON could not be read.",
    detail: "It has a syntax error somewhere — check it parses as valid JSON and try again.",
  },
  "not-a-pdf": {
    message: "That file is not a PDF.",
    detail: "Choose a PDF file — the one you get from an Export button.",
  },
  "unreadable-pdf": {
    message: "That PDF could not be opened.",
    detail: "It may be damaged or password protected. Try exporting it again.",
  },
  "no-attachments": {
    message: "That PDF has no quiz data inside it.",
    detail: "Only PDFs made by an Export button carry their questions. A scanned or printed copy cannot be read back.",
  },
  "no-record": {
    message: "That PDF has attachments, but none of them hold quiz data.",
    detail: "Export the quiz or progression again and import the file you get.",
  },
  "damaged-record": {
    message: "That PDF's quiz data is damaged.",
    detail: "It was found but could not be read. Export it again from the original class.",
  },
};

export const NOT_OURS = {
  message: "That file holds data, but not a quiz or a progression.",
  detail: "A quiz needs a title and questions; a progression needs a name and a list of quizzes.",
};
