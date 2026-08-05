import { fail, redirect } from "@sveltejs/kit";

const pocketBaseUrl = "http://127.0.0.1:8090";

function sanitize(code: unknown) {
  return String(code ?? "").replace(/\D/g, "").slice(0, 6);
}

// Validate a class code against PocketBase's public endpoint.
async function checkClassCode(code: string) {
  const response = await globalThis.fetch(`${pocketBaseUrl}/api/fact-friends/class-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ classCode: code }),
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, body };
}

// Auto-submit: a teacher-shared link like /?classCode=693174 is checked here on
// the server and forwarded straight to the name screen when the class exists.
export async function load({ url, cookies }) {
  const code = sanitize(url.searchParams.get("classCode"));
  // A student who is still signed in on this device goes straight to their own
  // home screen. A shared class link still leads to the name screen, so someone
  // else can sign in on the same device.
  if (!code && cookies.get("student_session")) redirect(303, "/home");
  if (!code) return { prefill: "" };
  if (!/^\d{4,6}$/.test(code)) return { prefill: code, error: "Enter the class code your teacher shared." };
  const { ok, body } = await checkClassCode(code);
  if (ok && body.classId) redirect(303, `/join/${code}`);
  return { prefill: code, error: body.message || "That class code was not found. Check with your teacher and try again." };
}

export const actions = {
  // Manual entry posts here; same server-side check, same forward-or-error.
  default: async ({ request }) => {
    const data = await request.formData();
    const code = sanitize(data.get("classCode"));
    if (!/^\d{4,6}$/.test(code)) return fail(400, { prefill: code, error: "Enter the class code your teacher shared." });
    const { ok, body } = await checkClassCode(code);
    if (ok && body.classId) redirect(303, `/join/${code}`);
    return fail(400, { prefill: code, error: body.message || "That class code was not found. Check with your teacher and try again." });
  },
};
