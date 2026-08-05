import {
  AFRelationship,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFString,
  decodePDFRawStream,
} from "pdf-lib";

// pdf-canonical-extraction: attach one file to the PDF whose /Desc is this
// string, and the data the page was rendered from travels with it. That single
// description is the entire specification — everything else here is convention.
// See https://pdfa.org/resource/iso-32000-2/ §7.11 and §14.13.
export const PDFCX_DESCRIPTION = "pdf-canonical-extraction";
const PDFCX_FILENAME = "pdfcx.json";

// Attach the record the document was rendered from. `AFRelationship: Source`
// says the record is the original and the page is the derivative, so a reader
// knows to trust this over anything it could scrape off the page.
export async function attachRecord(pdf: PDFDocument, record: unknown): Promise<void> {
  await pdf.attach(new TextEncoder().encode(JSON.stringify(record, null, 2)), PDFCX_FILENAME, {
    mimeType: "application/json",
    description: PDFCX_DESCRIPTION,
    afRelationship: AFRelationship.Source,
  });
}

function textOf(value: unknown): string {
  if (value instanceof PDFHexString || value instanceof PDFString) {
    try {
      return value.decodeText();
    } catch (_) {
      return value.asString();
    }
  }
  return "";
}

// Every file attached to the PDF, flattened out of the embedded-files name
// tree. The tree is either a leaf holding /Names — pairs of [name, file spec] —
// or a branch holding /Kids, so this walks both.
function collectAttachments(node: unknown, found: PDFDict[] = []): PDFDict[] {
  if (!(node instanceof PDFDict)) return found;

  // A leaf: /Names is a flat [name, spec, name, spec, …] array.
  const names = node.lookup(PDFName.of("Names"));
  if (names instanceof PDFArray) {
    for (let index = 1; index < names.size(); index += 2) {
      const spec = names.lookup(index);
      if (spec instanceof PDFDict) found.push(spec);
    }
  }

  // A branch: recurse into every child node.
  const kids = node.lookup(PDFName.of("Kids"));
  if (kids instanceof PDFArray) {
    for (let index = 0; index < kids.size(); index += 1) {
      collectAttachments(kids.lookup(index), found);
    }
  }
  return found;
}

function bytesOf(spec: PDFDict): Uint8Array | null {
  const files = spec.lookup(PDFName.of("EF"));
  if (!(files instanceof PDFDict)) return null;
  const stream = files.lookup(PDFName.of("F")) ?? files.lookup(PDFName.of("UF"));
  if (!(stream instanceof PDFRawStream)) return null;
  // The producer may have compressed it; decodePDFRawStream reads the /Filter
  // chain, so Flate and the rest come back as plain bytes either way.
  try {
    return decodePDFRawStream(stream).decode();
  } catch (_) {
    return stream.asUint8Array();
  }
}

// Why a file could not give up a record. Each case wants different advice, so
// they stay separate all the way to the message the teacher reads.
export type ExtractFailure = "not-a-pdf" | "unreadable-pdf" | "no-attachments" | "no-record" | "damaged-record";
export type ExtractResult = { ok: true; record: unknown } | { ok: false; reason: ExtractFailure };

function looksLikePdf(bytes: Uint8Array): boolean {
  // Every PDF starts %PDF-, though some tools leave junk in front of it.
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  return head.includes("%PDF-");
}

// Pull the canonical record back out of a PDF. Matching is on /Desc, because
// that is what the spec actually defines; the filename is only a fallback, so a
// record written by any other pdfcx producer still reads here whatever they
// chose to call it.
export async function extractRecord(bytes: Uint8Array): Promise<ExtractResult> {
  if (!looksLikePdf(bytes)) return { ok: false, reason: "not-a-pdf" };

  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false });
  } catch (_) {
    return { ok: false, reason: "unreadable-pdf" };
  }

  // A file can satisfy PDFDocument.load and still be missing the structure this
  // walk expects, so reading it is guarded too rather than only the load.
  let specs: PDFDict[];
  try {
    const names = pdf.catalog.lookup(PDFName.of("Names"));
    const embedded = names instanceof PDFDict ? names.lookup(PDFName.of("EmbeddedFiles")) : undefined;
    specs = collectAttachments(embedded);
  } catch (_) {
    return { ok: false, reason: "unreadable-pdf" };
  }
  if (!specs.length) return { ok: false, reason: "no-attachments" };

  const describe = (spec: PDFDict, key: string) => {
    try {
      return textOf(spec.lookup(PDFName.of(key)));
    } catch (_) {
      return "";
    }
  };
  const byDescription = specs.filter((spec) => describe(spec, "Desc") === PDFCX_DESCRIPTION);
  const byName = specs.filter((spec) => (describe(spec, "UF") || describe(spec, "F")).toLowerCase().includes("pdfcx"));

  const candidates = [...byDescription, ...byName];
  if (!candidates.length) return { ok: false, reason: "no-record" };

  for (const spec of candidates) {
    const payload = bytesOf(spec);
    if (!payload) continue;
    try {
      return { ok: true, record: JSON.parse(new TextDecoder().decode(payload)) };
    } catch (_) {
      continue; // Not JSON — try the next candidate rather than giving up.
    }
  }
  // The record is there and named right, but its contents will not parse.
  return { ok: false, reason: "damaged-record" };
}
