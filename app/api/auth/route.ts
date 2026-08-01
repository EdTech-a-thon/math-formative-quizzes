import { NextResponse } from "next/server";
import db from "@/lib/db";

type Teacher = { id: number; name: string; email: string; pin: string; allow_incomplete_answers: number };
const sessionCookie = "fact-friends-session";

function session(response: NextResponse, value: object) {
  response.cookies.set(sessionCookie, JSON.stringify(value), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30, path: "/" });
}

export async function POST(request: Request) {
  const body = await request.json();
  if (body.action === "signup") {
    const name = String(body.name || "").trim(); const email = String(body.email || "").trim().toLowerCase(); const pin = String(body.pin || "");
    if (!name || !email || !/^\d{4,6}$/.test(pin)) return NextResponse.json({ error: "Enter a name, email, and 4 to 6 digit PIN." }, { status: 400 });
    try { const result = db.prepare("INSERT INTO teachers (name, email, pin) VALUES (?, ?, ?)").run(name, email, pin); const response = NextResponse.json({ role: "teacher", teacher: { id: result.lastInsertRowid, name, email, allowIncompleteAnswers: false }, onboarding: true }); session(response, { role: "teacher", teacherId: result.lastInsertRowid }); return response; } catch { return NextResponse.json({ error: "A teacher account already uses that email." }, { status: 409 }); }
  }
  if (body.action === "login") {
    const type = body.accountType || "student";
    if (type === "teacher") { const teacher = db.prepare("SELECT * FROM teachers WHERE email = ? AND pin = ?").get(String(body.username).trim().toLowerCase(), String(body.pin).trim()) as Teacher | undefined; if (!teacher) return NextResponse.json({ error: "That teacher email and PIN do not match." }, { status: 401 }); const response = NextResponse.json({ role: "teacher", teacher: { id: teacher.id, name: teacher.name, email: teacher.email, allowIncompleteAnswers: !!teacher.allow_incomplete_answers } }); session(response, { role: "teacher", teacherId: teacher.id }); return response; }
    const code = String(body.pin || "").trim(); const login = String(body.username || "").toLowerCase().replace(/[^a-z]/g, "");
    const rows = db.prepare("SELECT s.*, c.teacher_id FROM students s JOIN classes c ON c.id = s.class_id WHERE c.code = ? AND c.archived = 0").all(code) as Array<{ id: string; name: string; class_id: string; levels: string; profile_icon: string | null; profile_color: string | null }>;
    const matches = rows.filter((student) => { const parts = student.name.toLowerCase().split(/\s+/); return `${parts[0]}${parts.at(-1)?.[0] || ""}` === login || student.name.toLowerCase().replace(/[^a-z]/g, "") === login; });
    if (matches.length !== 1) return NextResponse.json({ matches: matches.map((student) => ({ id: student.id, name: student.name, profileIcon: student.profile_icon, profileColor: student.profile_color })), error: matches.length ? "Choose your profile." : "That name and class code do not match." }, { status: matches.length ? 300 : 401 });
    const student = matches[0]; const response = NextResponse.json({ role: "student", student: { id: student.id, name: student.name, classId: student.class_id, levels: JSON.parse(student.levels), profileIcon: student.profile_icon, profileColor: student.profile_color } }); session(response, { role: "student", studentId: student.id }); return response;
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

export async function DELETE() { const response = NextResponse.json({ ok: true }); response.cookies.set(sessionCookie, "", { maxAge: 0, path: "/" }); return response; }
