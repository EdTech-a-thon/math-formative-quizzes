import { json } from "@sveltejs/kit";
import { savePathOfQuizzes } from "$lib/server/saveProgression";
import { isStarterPath, starterProgression, starterQuizIds } from "$lib/server/starterPaths";
import { teacherAuthorization, teacherPocketBaseRequest } from "$lib/server/pocketbase";

function loginName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

export async function POST({ request, cookies }) {
  const body = await request.json();
  const signupMode = body.signupMode === "open" ? "open" : "closed";
  const name = String(body.name || "").trim();
  const studentNames: string[] = (body.students || [])
    .map((student: { name?: unknown }) => String(student?.name ?? "").trim())
    .filter(Boolean);
  const selectedPaths: unknown[] = Array.isArray(body.starterPaths) ? body.starterPaths : [];
  // Pacing chosen during setup applies to every path this class starts with.
  const selfPaced = body.selfPaced === true;

  if (!name) return json({ message: "Add a class name." }, { status: 400 });
  if (signupMode === "closed" && !studentNames.length)
    return json({ message: "Add at least one student or import a roster." }, { status: 400 });
  if (selectedPaths.some((path) => !isStarterPath(path)))
    return json({ message: "Choose one of the four ready-made learning paths." }, { status: 400 });

  const teacher = await teacherPocketBaseRequest<{ record: { id: string } }>(
    cookies,
    "/api/collections/teachers/auth-refresh",
    { method: "POST" },
  );
  const usedCodes = await teacherPocketBaseRequest<{ items: { classCode: string }[] }>(
    cookies,
    "/api/collections/classes/records?perPage=500",
  );
  let classCode = "";
  do classCode = String(Math.floor(100000 + Math.random() * 900000));
  while (usedCodes.items.some((item) => item.classCode === classCode));

  // Teachers can start with the ready-made paths, or leave the class empty and
  // create their own quizzes later.
  const classRoom = await teacherPocketBaseRequest<{ id: string }>(
    cookies,
    "/api/collections/classes/records",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teacher: teacher.record.id,
        name,
        classCode,
        archived: false,
        levelFormats: { signupMode },
      }),
    },
  );

  try {
    for (const studentName of studentNames) {
      await teacherPocketBaseRequest(cookies, "/api/collections/students/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class: classRoom.id,
          name: studentName,
          loginName: loginName(studentName),
        }),
      });
    }
    const authorization = teacherAuthorization(cookies);
    for (const path of new Set(selectedPaths)) {
      if (isStarterPath(path)) {
        // Built from the ready-made quizzes already in her library, so every
        // class on this path shares them rather than getting its own copies.
        const quizIds = await starterQuizIds(authorization, teacher.record.id, path);
        await savePathOfQuizzes(authorization, classRoom.id, { ...starterProgression(path), selfPaced }, quizIds);
      }
    }
  } catch (caught) {
    return json({
      classRoom,
      message: caught instanceof Error ? caught.message : "The class was created, but part of the setup could not be completed.",
    }, { status: 500 });
  }

  return json({ classRoom });
}
