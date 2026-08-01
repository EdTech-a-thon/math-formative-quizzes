import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

type SavedClass = { id: string; [key: string]: unknown };
type SavedStudent = { id: string; classId: string; [key: string]: unknown };
type SavedState = { classes?: unknown; students?: unknown; [key: string]: unknown };

function session(request: NextRequest) {
  try { return JSON.parse(request.cookies.get("fact-friends-session")?.value || "null") as { role: string; teacherId?: number } | null; } catch { return null; }
}

function normalizeState(value: unknown) {
  const state: SavedState = value && typeof value === "object" && !Array.isArray(value) ? value as SavedState : {};
  const classIds = new Set<string>();
  const classes = (Array.isArray(state.classes) ? state.classes : []).filter((item): item is SavedClass => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const id = (item as SavedClass).id;
    if (typeof id !== "string" || !id || classIds.has(id)) return false;
    classIds.add(id);
    return true;
  });
  const studentIds = new Set<string>();
  const studentNames = new Set<string>();
  const students = (Array.isArray(state.students) ? state.students : []).filter((item): item is SavedStudent => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const { id, classId, name } = item as SavedStudent & { name?: unknown };
    const rosterName = typeof name === "string" ? name.trim().toLocaleLowerCase() : "";
    const rosterKey = `${classId}:${rosterName}`;
    if (typeof id !== "string" || !id || typeof classId !== "string" || !classIds.has(classId) || studentIds.has(id) || !rosterName || studentNames.has(rosterKey)) return false;
    studentIds.add(id);
    studentNames.add(rosterKey);
    return true;
  });
  return { ...state, classes, students };
}

export async function GET(request: NextRequest) {
  const current = session(request);
  if (!current?.teacherId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const row = db.prepare("SELECT data FROM teacher_state WHERE teacher_id = ?").get(current.teacherId) as { data: string } | undefined;
  if (!row) return NextResponse.json({ state: null });
  const state = normalizeState(JSON.parse(row.data));
  const data = JSON.stringify(state);
  if (data !== row.data) db.prepare("UPDATE teacher_state SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE teacher_id = ?").run(data, current.teacherId);
  return NextResponse.json({ state });
}

export async function POST(request: NextRequest) {
  const current = session(request);
  if (!current?.teacherId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const state = normalizeState(await request.json());
  const replace = db.transaction(() => {
    db.prepare("DELETE FROM students WHERE class_id IN (SELECT id FROM classes WHERE teacher_id = ?)").run(current.teacherId);
    db.prepare("DELETE FROM classes WHERE teacher_id = ?").run(current.teacherId);
    const insertClass = db.prepare("INSERT INTO classes (id, teacher_id, name, code, archived, operations) VALUES (?, ?, ?, ?, ?, ?)");
    const insertStudent = db.prepare("INSERT INTO students (id, class_id, name, levels, profile_icon, profile_color) VALUES (?, ?, ?, ?, ?, ?)");
    for (const classRoom of state.classes || []) insertClass.run(classRoom.id, current.teacherId, classRoom.name, classRoom.pin, classRoom.archived ? 1 : 0, JSON.stringify(classRoom.operations || []));
    for (const student of state.students || []) insertStudent.run(student.id, student.classId, student.name, JSON.stringify(student.levels), student.profileIcon || null, student.profileColor || null);
    db.prepare("INSERT INTO teacher_state (teacher_id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(teacher_id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP").run(current.teacherId, JSON.stringify(state));
  });
  replace();
  return NextResponse.json({ ok: true });
}
