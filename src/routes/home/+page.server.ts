import { redirect } from "@sveltejs/kit";

const pocketBaseUrl = "http://127.0.0.1:8090";

export async function load({ cookies }) {
  const studentId = cookies.get("student_session");
  if (!studentId) redirect(303, "/");

  const response = await globalThis.fetch(`${pocketBaseUrl}/api/fact-friends/student-home`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId }),
  });
  // The student was removed from the class, so this device is signed out.
  if (!response.ok) {
    cookies.delete("student_session", { path: "/" });
    redirect(303, "/");
  }
  return await response.json();
}

export const actions = {
  signOut: async ({ cookies }) => {
    cookies.delete("student_session", { path: "/" });
    redirect(303, "/");
  },
};
