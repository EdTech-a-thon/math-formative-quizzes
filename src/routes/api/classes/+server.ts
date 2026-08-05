import { error, json } from "@sveltejs/kit";

const pocketBaseUrl = "http://127.0.0.1:8090";

function loginName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

async function pocketBaseRequest(
  path: string,
  auth: string,
  init: RequestInit = {},
) {
  const response = await fetch(`${pocketBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body.message || "PocketBase request failed.");
  return body;
}

export async function POST({ request, cookies }) {
  const teacherToken = cookies.get("teacher_session");
  if (!teacherToken) error(401, "Please sign in again.");

  const body = await request.json();
  const signupMode = body.signupMode === "open" ? "open" : "closed";
  const name = String(body.name || "").trim();
  const studentNames: string[] = (body.students || [])
    .map((student: { name?: unknown }) => String(student?.name ?? "").trim())
    .filter(Boolean);

  if (!name) return json({ message: "Add a class name." }, { status: 400 });
  if (signupMode === "closed" && !studentNames.length)
    return json({ message: "Add at least one student or import a roster." }, { status: 400 });

  const auth = `Bearer ${teacherToken}`;
  const teacher = await pocketBaseRequest(
    "/api/collections/teachers/auth-refresh",
    auth,
    { method: "POST" },
  );
  const usedCodes = await pocketBaseRequest(
    "/api/collections/classes/records?perPage=500",
    auth,
  );
  let classCode = "";
  do classCode = String(Math.floor(100000 + Math.random() * 900000));
  while (
    usedCodes.items.some(
      (item: { classCode: string }) => item.classCode === classCode,
    )
  );

  // A new class starts empty. Quizzes and progressions arrive either by being
  // built in the app or by importing a PDF someone exported.
  const classRoom = await pocketBaseRequest(
    "/api/collections/classes/records",
    auth,
    {
      method: "POST",
      body: JSON.stringify({
        teacher: teacher.record.id,
        name,
        classCode,
        archived: false,
        levelFormats: { signupMode },
      }),
    },
  );

  for (const studentName of studentNames) {
    await pocketBaseRequest("/api/collections/students/records", auth, {
      method: "POST",
      body: JSON.stringify({
        class: classRoom.id,
        name: studentName,
        loginName: loginName(studentName),
      }),
    });
  }

  return json({ classRoom });
}
