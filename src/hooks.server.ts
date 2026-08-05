const pocketBaseUrl = "http://127.0.0.1:8090";

export async function handle({ event, resolve }) {
  const token = event.cookies.get("teacher_session");
  event.locals.teacher = null;

  if (token) {
    try {
      const response = await fetch(`${pocketBaseUrl}/api/collections/teachers/auth-refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const { record } = await response.json();
        event.locals.teacher = { id: record.id, name: record.name, email: record.email };
      } else {
        // The sign-in has genuinely expired or been revoked, so clear it.
        event.cookies.delete("teacher_session", { path: "/" });
      }
    } catch {
      // The database is unreachable. Treat this request as signed out, but keep
      // the cookie so the teacher is still signed in once it is back, rather
      // than failing every page in the app.
    }
  }

  return resolve(event);
}
