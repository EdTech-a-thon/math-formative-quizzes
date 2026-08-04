import { json } from "@sveltejs/kit";

const pocketBaseUrl = "http://127.0.0.1:8090";

export async function POST({ request, cookies }) {
  const { action, name, email, password } = await request.json();
  const identity = String(email || "").trim().toLowerCase();

  try {
    if (action === "sign-up") {
      const create = await fetch(`${pocketBaseUrl}/api/collections/teachers/records`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: String(name || "").trim(), email: identity, password, passwordConfirm: password, allowIncompleteAnswers: false, theme: "playful" }) });
      if (!create.ok) throw new Error("That email address is already in use.");
    }
    const auth = await fetch(`${pocketBaseUrl}/api/collections/teachers/auth-with-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identity, password }) });
    const result = await auth.json();
    if (!auth.ok) throw new Error("That email address and password do not match.");
    cookies.set("teacher_session", result.token, { path: "/", httpOnly: true, sameSite: "lax", secure: false, maxAge: 60 * 60 * 24 * 30 });
    return json({ ok: true });
  } catch (error) {
    return json({ message: error instanceof Error ? error.message : "We could not complete that request." }, { status: 400 });
  }
}

export function DELETE({ cookies }) {
  cookies.delete("teacher_session", { path: "/" });
  return json({ ok: true });
}
