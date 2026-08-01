import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(request: NextRequest) {
  const raw = request.cookies.get("fact-friends-session")?.value;
  if (!raw) return NextResponse.json({ session: null });
  try {
    const session = JSON.parse(raw);
    if (session.role === "teacher") { const teacher = db.prepare("SELECT id, name, email, allow_incomplete_answers FROM teachers WHERE id = ?").get(session.teacherId) as { id: number; name: string; email: string; allow_incomplete_answers: number } | undefined; if (!teacher) return NextResponse.json({ session: null }); return NextResponse.json({ session: { role: "teacher", teacher: { ...teacher, allowIncompleteAnswers: !!teacher.allow_incomplete_answers } } }); }
    const student = db.prepare("SELECT id, name, class_id, levels, profile_icon, profile_color FROM students WHERE id = ?").get(session.studentId) as { id: string; name: string; class_id: string; levels: string; profile_icon: string | null; profile_color: string | null } | undefined;
    return NextResponse.json({ session: student ? { role: "student", student: { id: student.id, name: student.name, classId: student.class_id, levels: JSON.parse(student.levels), profileIcon: student.profile_icon, profileColor: student.profile_color } } : null });
  } catch { return NextResponse.json({ session: null }); }
}
