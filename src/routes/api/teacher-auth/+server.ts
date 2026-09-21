import { json } from "@sveltejs/kit";
import { pocketBaseRequest } from "$lib/server/pocketbase";

type Authentication = { token: string };

export async function POST({ request, cookies }) {
  const { action, name, email, password } = await request.json();
  const identity = String(email || "").trim().toLowerCase();

  try {
    if (action === "sign-up") {
      await pocketBaseRequest(
        "/api/collections/teachers/records",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: String(name || "").trim(), email: identity, password, passwordConfirm: password, allowIncompleteAnswers: false, theme: "playful" }),
          errorMessage: "That email address is already in use.",
          preferErrorMessage: true,
        },
      );
    }
    const result = await pocketBaseRequest<Authentication>(
      "/api/collections/teachers/auth-with-password",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity, password }),
        errorMessage: "That email address and password do not match.",
      },
    );
    cookies.set("teacher_session", result.token, { path: "/", httpOnly: true, sameSite: "lax", secure: false, maxAge: 60 * 60 * 24 * 30 });
    return json({ ok: true });
  } catch (caught) {
    return json({ message: caught instanceof Error ? caught.message : "We could not complete that request." }, { status: 400 });
  }
}

export function DELETE({ cookies }) {
  cookies.delete("teacher_session", { path: "/" });
  return json({ ok: true });
}
