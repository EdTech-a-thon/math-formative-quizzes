export const pocketBaseUrl = "http://127.0.0.1:8090";

// Turn a title into something safe to hand a filesystem, so the download lands
// as "multiply-by-2.pdf" rather than anything with a slash in it.
function fileNameFor(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "export"}.pdf`;
}

export function pdfResponse(bytes: Uint8Array, title: string): Response {
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileNameFor(title)}"`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "no-store",
    },
  });
}
