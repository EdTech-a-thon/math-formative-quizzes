import { fail, redirect } from "@sveltejs/kit";

const pocketBaseUrl = "http://127.0.0.1:8090";

async function pocketBasePost(path: string, payload: unknown) {
  const response = await globalThis.fetch(`${pocketBaseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, body };
}

// The name-submission screen. Re-check the code on the server so a stale or bad
// link bounces back to the code entry instead of showing an empty screen.
export async function load({ params }) {
  const code = String(params.classCode).replace(/\D/g, "").slice(0, 6);
  const { ok, body } = await pocketBasePost("/api/fact-friends/class-code", { classCode: code });
  if (!ok || !body.classId) redirect(303, `/?classCode=${encodeURIComponent(code)}`);
  return { classCode: code, className: body.className as string };
}

export const actions = {
  default: async ({ request, params, cookies }) => {
    const data = await request.formData();
    const name = String(data.get("name") ?? "").trim();
    const remember = data.get("remember") === "on";
    if (!name) return fail(400, { error: "Enter your name to continue." });
    const { ok, body } = await pocketBasePost("/api/fact-friends/join", { classCode: params.classCode, name });
    if (!ok) return fail(400, { name, error: body.message || "We could not add you to the class." });

    // Signing in keeps the student on this device. "Remember me" is what decides
    // whether that outlives closing the browser.
    cookies.set("student_session", body.studentId as string, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      ...(remember ? { maxAge: 60 * 60 * 24 * 60 } : {}),
    });
    redirect(303, "/home");
  },
};
