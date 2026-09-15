import { error, json } from "@sveltejs/kit";

const pocketBaseUrl = "http://127.0.0.1:8090";

function loginName(name: string) {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

export async function POST({ params, request, cookies }) {
  const teacherToken = cookies.get("teacher_session");
  if (!teacherToken) error(401, "Please sign in again.");

  const body = await request.json().catch(() => ({}));
  const names = (Array.isArray(body.names) ? body.names : [])
    .map((name: unknown) => String(name).trim())
    .filter(Boolean);

  if (!names.length) return json({ message: "Add at least one student name." }, { status: 400 });
  if (names.some((name: string) => name.length > 120)) return json({ message: "Student names must be 120 characters or fewer." }, { status: 400 });

  const authorization = `Bearer ${teacherToken}`;
  const headers = { "Content-Type": "application/json", Authorization: authorization };
  const classResponse = await fetch(`${pocketBaseUrl}/api/collections/classes/records/${params.id}`, { headers });
  if (!classResponse.ok) return json({ message: "We could not find this class." }, { status: classResponse.status });

  const requested = names.map((name: string) => ({ name, loginName: loginName(name) }));
  if (requested.some((student: { loginName: string }) => !student.loginName)) {
    return json({ message: "Each student name needs at least one letter." }, { status: 400 });
  }

  const duplicateInList = requested.find((student: { loginName: string }, index: number) =>
    requested.findIndex((other: { loginName: string }) => other.loginName === student.loginName) !== index,
  );
  if (duplicateInList) return json({ message: `${duplicateInList.name} appears more than once in this list.` }, { status: 400 });

  const filter = encodeURIComponent(`class="${params.id}"`);
  const existingResponse = await fetch(`${pocketBaseUrl}/api/collections/students/records?perPage=500&fields=loginName&filter=${filter}`, { headers });
  const existing = existingResponse.ok ? (await existingResponse.json()).items : [];
  const existingNames = new Set(existing.map((student: { loginName: string }) => student.loginName));
  const duplicate = requested.find((student: { loginName: string }) => existingNames.has(student.loginName));
  if (duplicate) return json({ message: `${duplicate.name} is already on this roster.` }, { status: 409 });

  const added = [];
  for (const student of requested) {
    const response = await fetch(`${pocketBaseUrl}/api/collections/students/records`, {
      method: "POST",
      headers,
      body: JSON.stringify({ class: params.id, name: student.name, loginName: student.loginName }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return json({ message: result.message || "We could not add these students.", added: added.length }, { status: response.status });
    added.push(result);
  }

  return json({ added: added.length });
}
