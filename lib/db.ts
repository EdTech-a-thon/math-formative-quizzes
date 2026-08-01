import Database from "better-sqlite3";
import path from "node:path";

const db = new Database(path.join(process.cwd(), "data.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    pin TEXT NOT NULL,
    allow_incomplete_answers INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    archived INTEGER NOT NULL DEFAULT 0,
    operations TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    levels TEXT NOT NULL,
    profile_icon TEXT,
    profile_color TEXT
  );
  CREATE TABLE IF NOT EXISTS teacher_state (
    teacher_id INTEGER PRIMARY KEY REFERENCES teachers(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

let demo = db.prepare("SELECT id FROM teachers WHERE email = ?").get("msrivera") as { id: number } | undefined;
if (!demo) {
  const result = db.prepare("INSERT INTO teachers (name, email, pin) VALUES (?, ?, ?)").run("Ms. Rivera", "msrivera", "2468");
  demo = { id: Number(result.lastInsertRowid) };
}

db.prepare("INSERT OR IGNORE INTO classes (id, teacher_id, name, code, archived, operations) VALUES (?, ?, ?, ?, ?, ?)").run(
  "room-12", demo.id, "Room 12 Math Stars", "638214", 0, JSON.stringify(["multiplication", "division", "addition", "subtraction"]),
);
db.prepare("UPDATE classes SET code = ? WHERE id = ?").run("638214", "room-12");

const demoStudents = [
  ["ava", "Ava Martinez", { multiplication: 4, division: 2, addition: 12, subtraction: 7 }],
  ["leo", "Leo Chen", { multiplication: 6, division: 4, addition: 15, subtraction: 8 }],
  ["maya", "Maya Johnson", { multiplication: 3, division: 1, addition: 10, subtraction: 5 }],
] as const;
const insertDemoStudent = db.prepare("INSERT OR IGNORE INTO students (id, class_id, name, levels) VALUES (?, ?, ?, ?)");
for (const [id, name, levels] of demoStudents) insertDemoStudent.run(id, "room-12", name, JSON.stringify(levels));

export default db;
