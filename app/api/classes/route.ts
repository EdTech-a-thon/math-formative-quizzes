import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

function getSession(request: NextRequest) {
  try { return JSON.parse(request.cookies.get("fact-friends-session")?.value || "null") as { role: string; teacherId: number } | null; } catch { return null; }
}

export async function GET(request: NextRequest) {
  const session = getSession(request);
  if (!session || session.role !== "teacher") return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const classes = db.prepare("SELECT * FROM classes WHERE teacher_id = ? ORDER BY name").all(session.teacherId) as Array<{ id: string; name: string; code: string; archived: number; operations: string }>;
  const students = db.prepare("SELECT * FROM students WHERE class_id IN (SELECT id FROM classes WHERE teacher_id = ?)").all(session.teacherId) as Array<{ id: string; class_id: string; name: string; levels: string; profile_icon: string | null; profile_color: string | null }>;
  return NextResponse.json({ classes: classes.map((item) => ({ id: item.id, name: item.name, pin: item.code, archived: !!item.archived, teacherEmail: String(session.teacherId), operations: JSON.parse(item.operations) })), students: students.map((item) => ({ id: item.id, classId: item.class_id, name: item.name, levels: JSON.parse(item.levels), profileIcon: item.profile_icon, profileColor: item.profile_color })) });
}

export async function POST(request: NextRequest) {
  const session = getSession(request); const body = await request.json();
  if (!session || session.role !== "teacher") return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const insertClass = db.prepare("INSERT INTO classes (id, teacher_id, name, code, operations) VALUES (?, ?, ?, ?, ?)");
  const insertStudent = db.prepare("INSERT INTO students (id, class_id, name, levels) VALUES (?, ?, ?, ?)");
  const save = db.transaction((payload: { name: string; code: string; operations: string[]; students: Array<{ id: string; name: string; levels: Record<string, number> }> }) => { const id = crypto.randomUUID(); insertClass.run(id, session.teacherId, payload.name, payload.code, JSON.stringify(payload.operations)); payload.students.forEach((student) => insertStudent.run(student.id, id, student.name, JSON.stringify(student.levels))); return id; });
  try { const id = save(body); return NextResponse.json({ id }); } catch { return NextResponse.json({ error: "That class code is already in use." }, { status: 409 }); }
}
