import { json } from "@sveltejs/kit";
import { pocketBaseError, teacherPocketBaseRequest } from "$lib/server/pocketbase";

function loginName(name: string) {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

export async function POST({ params, request, cookies }) {
  const body = await request.json().catch(() => ({}));
  const names = (Array.isArray(body.names) ? body.names : [])
    .map((name: unknown) => String(name).trim())
    .filter(Boolean);

  if (!names.length) return json({ message: "Add at least one student name." }, { status: 400 });
  if (names.some((name: string) => name.length > 120)) return json({ message: "Student names must be 120 characters or fewer." }, { status: 400 });

  const requested = names.map((name: string) => ({ name, loginName: loginName(name) }));
  if (requested.some((student: { loginName: string }) => !student.loginName)) {
    return json({ message: "Each student name needs at least one letter." }, { status: 400 });
  }

  const duplicateInList = requested.find((student: { loginName: string }, index: number) =>
    requested.findIndex((other: { loginName: string }) => other.loginName === student.loginName) !== index,
  );
  if (duplicateInList) return json({ message: `${duplicateInList.name} appears more than once in this list.` }, { status: 400 });

  try {
    await teacherPocketBaseRequest(
      cookies,
      `/api/collections/classes/records/${params.id}`,
      { errorMessage: "We could not find this class.", preferErrorMessage: true },
    );

    const filter = encodeURIComponent(`class="${params.id}"`);
    const existing = await teacherPocketBaseRequest<{ items: { loginName: string }[] }>(
      cookies,
      `/api/collections/students/records?perPage=500&fields=loginName&filter=${filter}`,
      { errorMessage: "We could not find the class roster." },
    );
    const existingNames = new Set(existing.items.map((student) => student.loginName));
    const duplicate = requested.find((student: { loginName: string }) => existingNames.has(student.loginName));
    if (duplicate) return json({ message: `${duplicate.name} is already on this roster.` }, { status: 409 });

    let added = 0;
    for (const student of requested) {
      await teacherPocketBaseRequest(
        cookies,
        "/api/collections/students/records",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ class: params.id, name: student.name, loginName: student.loginName }),
          errorMessage: "We could not add these students.",
        },
      );
      added++;
    }
    return json({ added });
  } catch (caught) {
    const failure = pocketBaseError(caught, "We could not add these students.");
    return json({ message: failure.message }, { status: failure.status });
  }
}
