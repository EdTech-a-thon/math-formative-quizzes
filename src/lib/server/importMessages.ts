import type { ExtractFailure } from "$lib/server/pdfcx";

// Each failure gets its own wording, because "it did not work" leaves a teacher
// with nothing to try next.
export const FAILURE_MESSAGES: Record<ExtractFailure, { message: string; detail: string }> = {
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
  message: "That PDF holds data, but not a quiz or a progression.",
  detail: "It carries a record this app does not recognise, or one with no questions in it.",
};
