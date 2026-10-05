import { redirect } from "@sveltejs/kit";

import { pocketBaseUrl, teacherAuthorization } from "$lib/server/pocketbase";

type ClassRoom = { id: string; name: string; classCode: string; archived: boolean; studentCount: number };

export async function load({ locals, cookies }) {
  if (!locals.teacher) redirect(303, "/teacher");
  const response = await globalThis.fetch(`${pocketBaseUrl}/api/collections/classes/records?perPage=100`, {
    headers: { Authorization: teacherAuthorization(cookies) },
  });
  if (!response.ok) {
    console.error("Unable to load classes from PocketBase", response.status, await response.text());
    return { teacher: locals.teacher, classes: [] as ClassRoom[] };
  }
  const result = await response.json();
  const classes = await Promise.all(
    result.items.map(async (classRoom: Omit<ClassRoom, "studentCount">) => {
      const studentsResponse = await globalThis.fetch(
        `${pocketBaseUrl}/api/collections/students/records?perPage=1&filter=class%3D%22${classRoom.id}%22`,
        { headers: { Authorization: teacherAuthorization(cookies) } },
      );
      const students = studentsResponse.ok ? await studentsResponse.json() : { totalItems: 0 };
      return { ...classRoom, studentCount: students.totalItems };
    }),
  );
  return { teacher: locals.teacher, classes };
}
