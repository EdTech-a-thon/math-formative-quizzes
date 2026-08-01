"use client";

import { Dispatch, FormEvent, SetStateAction, useEffect, useRef, useState } from "react";

type Operation = "multiplication" | "division" | "addition" | "subtraction";
type Role = "teacher" | "student";
type QuizType = "leveling" | "practice";
type Theme = "playful" | "red" | "orange" | "yellow" | "green" | "blue" | "purple" | "mono";
type LevelFormat = { style: "number" | "letter"; labels: Record<string, string> };
type ClassRoom = { id: string; name: string; pin: string; archived: boolean; teacherEmail: string; operations: Operation[]; levelFormats?: Partial<Record<Operation, LevelFormat>> };
type TeacherAccount = { name: string; email: string; pin: string; allowIncompleteAnswers: boolean };

type Student = {
  id: string;
  name: string;
  classId: string;
  profileIcon?: string;
  profileColor?: string;
  levels: Record<Operation, number>;
};

type Quiz = {
  id: string;
  classId: string;
  status: "draft" | "assigned";
  assignedAt: string | null;
  title: string;
  operation: Operation;
  group: number;
  factGroups: { group: number; questions: number }[];
  focusMode: "selected" | "student-level";
  includeLowerGroups: boolean;
  belowLevelQuestions: number;
  problems: number;
  minutes: number;
  type: QuizType;
  threshold: number;
  showScore: boolean;
  passMessage: string;
  failMessage: string;
  levelMessage: string;
  assignedTo: string[];
};

type Result = {
  quizId: string;
  studentId: string;
  correct: number;
  total: number;
  leveledUp: boolean;
  completedAt: string;
};

type Problem = { top: number; bottom: number; symbol: string; answer: number };

const operations: { value: Operation; label: string; symbol: string; color: string; range: [number, number] }[] = [
  { value: "multiplication", label: "Multiplication", symbol: "x", color: "violet", range: [0, 12] },
  { value: "division", label: "Division", symbol: "÷", color: "sky", range: [1, 12] },
  { value: "addition", label: "Addition", symbol: "+", color: "orange", range: [0, 20] },
  { value: "subtraction", label: "Subtraction", symbol: "−", color: "rose", range: [0, 9] },
];

const demoClasses: ClassRoom[] = [
  { id: "room-12", name: "Room 12 Math Stars", pin: "638214", archived: false, teacherEmail: "msrivera", operations: ["multiplication", "division", "addition", "subtraction"] },
  { id: "afternoon", name: "Afternoon Number Crew", pin: "4826", archived: false, teacherEmail: "msrivera", operations: ["multiplication", "division", "addition", "subtraction"] },
];

const demoStudents: Student[] = [
  { id: "ava", name: "Ava Martinez", classId: "room-12", levels: { multiplication: 4, division: 2, addition: 12, subtraction: 7 } },
  { id: "leo", name: "Leo Chen", classId: "room-12", levels: { multiplication: 6, division: 4, addition: 15, subtraction: 8 } },
  { id: "maya", name: "Maya Johnson", classId: "room-12", levels: { multiplication: 3, division: 1, addition: 10, subtraction: 5 } },
  { id: "noah", name: "Noah Williams", classId: "afternoon", levels: { multiplication: 2, division: 1, addition: 8, subtraction: 4 } },
];

const starterQuiz: Quiz = {
  id: "starter-quiz", classId: "room-12", status: "assigned", assignedAt: "2026-07-20T09:00:00.000Z",
  title: "Multiply by 5", operation: "multiplication", group: 5, factGroups: [{ group: 5, questions: 10 }], focusMode: "selected", includeLowerGroups: false, belowLevelQuestions: 0, problems: 10, minutes: 2,
  type: "leveling", threshold: 80, showScore: true,
  passMessage: "Great work! You passed this quiz.", failMessage: "Keep practicing. You are getting stronger every day!",
  levelMessage: "Amazing! You leveled up your multiplication facts!", assignedTo: ["ava", "maya"],
};

const operationInfo = (operation: Operation) => operations.find((item) => item.value === operation)!;
const defaultLevelLabel = (operation: Operation, group: number, style: "number" | "letter" = "number") => style === "letter" ? String.fromCharCode(65 + group - operationInfo(operation).range[0]) : String(group);
const levelLabel = (classRoom: ClassRoom, operation: Operation, group: number) => classRoom.levelFormats?.[operation]?.labels[String(group)] || defaultLevelLabel(operation, group, classRoom.levelFormats?.[operation]?.style);
const normalizeLoginName = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");
const studentLoginName = (name: string) => {
  const parts = name.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0]}${parts[parts.length - 1][0]}` : parts[0] || "";
};
const profileIcons = ["★", "●", "◆", "✦", "☀", "♥", "♣", "✿"];
const profileColors = ["#ffbc77", "#8bd3dd", "#b6a0f5", "#f49a9e", "#9ad69a", "#f5d676"];
function uniqueById<T extends { id: string }>(items: T[]) {
  const ids = new Set<string>();
  return items.filter((item) => !ids.has(item.id) && (ids.add(item.id), true));
}
function generateClassCode(classes: ClassRoom[]) {
  const used = new Set(classes.map((entry) => entry.pin));
  let code = "";
  do code = String(Math.floor(100000 + Math.random() * 900000)); while (used.has(code));
  return code;
}
const groupLabel = (operation: Operation, group: number) => `${operationInfo(operation).label} ${group}s`;
const dateLabel = (date: string) => new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const fullDateLabel = (date: string) => new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function useHistoryState<T>(key: string, value: T, setValue: Dispatch<SetStateAction<T>>) {
  useEffect(() => {
    if (!(key in window.history.state || {})) window.history.replaceState({ ...window.history.state, [key]: value }, "");
    const restore = (event: PopStateEvent) => {
      if (key in (event.state || {})) setValue(event.state[key] as T);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [key, setValue, value]);
  return (next: T) => {
    if (Object.is(next, value)) return;
    window.history.pushState({ ...window.history.state, [key]: next }, "");
    setValue(next);
  };
}

function makeProblems(operation: Operation, groups: { group: number; questions: number }[]): Problem[] {
  const source: Problem[] = [];
  for (const { group, questions } of groups) {
    const bank: Problem[] = [];
    if (operation === "multiplication") for (let other = 0; other <= 12; other++) bank.push(Math.random() < .5 ? { top: group, bottom: other, symbol: "×", answer: group * other } : { top: other, bottom: group, symbol: "×", answer: group * other });
    if (operation === "division") for (let other = 0; other <= 12; other++) bank.push({ top: group * other, bottom: group, symbol: "÷", answer: other });
    if (operation === "addition") for (let other = 0; other <= 20; other++) bank.push(Math.random() < .5 ? { top: group, bottom: other, symbol: "+", answer: group + other } : { top: other, bottom: group, symbol: "+", answer: group + other });
    if (operation === "subtraction") for (let minuend = group; minuend <= 18; minuend++) bank.push({ top: minuend, bottom: group, symbol: "−", answer: minuend - group });
    const shuffledBank = [...bank].sort(() => Math.random() - 0.5);
    source.push(...Array.from({ length: questions }, (_, index) => shuffledBank[index % shuffledBank.length]));
  }
  return source.sort(() => Math.random() - 0.5);
}

function personalizedGroups(operation: Operation, level: number, total: number, includeLower: boolean, belowLevelQuestions: number) {
  const minimum = operationInfo(operation).range[0];
  const lowerLevels = Array.from({ length: Math.max(0, level - minimum) }, (_, index) => minimum + index);
  if (!includeLower || !lowerLevels.length || !belowLevelQuestions) return [{ group: level, questions: total }];
  const lowerTotal = Math.min(total, belowLevelQuestions);
  const groups = lowerLevels.map((group, index) => ({ group, questions: Math.floor(lowerTotal / lowerLevels.length) + (index < lowerTotal % lowerLevels.length ? 1 : 0) })).filter((item) => item.questions > 0);
  if (total > lowerTotal) groups.push({ group: level, questions: total - lowerTotal });
  return groups;
}

export default function Home() {
  const [teachers, setTeachers] = useState<TeacherAccount[]>([{ name: "Ms. Rivera", email: "msrivera", pin: "2468", allowIncompleteAnswers: false }]);
  const [classes, setClasses] = useState<ClassRoom[]>(demoClasses);
  const [students, setStudents] = useState<Student[]>(demoStudents);
  const [quizzes, setQuizzes] = useState<Quiz[]>([starterQuiz]);
  const [results, setResults] = useState<Result[]>([]);
  const [role, setRole] = useState<Role | null>(null);
  const [currentTeacher, setCurrentTeacher] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [loginMatches, setLoginMatches] = useState<Student[]>([]);
  const [profileSetup, setProfileSetup] = useState(false);
  const [teacherView, setTeacherView] = useState<"home" | "students" | "create" | "quizzes" | "results" | "settings">("home");
  const [theme, setTheme] = useState<Theme>("playful");
  const [studentView, setStudentView] = useState<"home" | "quiz" | "history">("home");
  const [loginError, setLoginError] = useState("");
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [outcome, setOutcome] = useState<Result | null>(null);
  const [answerWarning, setAnswerWarning] = useState("");
  const sessionLoaded = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("fact-friends-theme") as Theme | null;
    const savedTeachers = window.localStorage.getItem("fact-friends-teachers");
    const savedClasses = window.localStorage.getItem("fact-friends-classes");
    const savedStudents = window.localStorage.getItem("fact-friends-students");
    if (savedTheme && ["playful", "red", "orange", "yellow", "green", "blue", "purple", "mono"].includes(savedTheme)) setTheme(savedTheme);
    if (savedTeachers) setTeachers(JSON.parse(savedTeachers).map((teacher: TeacherAccount) => ({ ...teacher, name: teacher.name || teacher.email, allowIncompleteAnswers: teacher.allowIncompleteAnswers ?? false })));
    if (savedClasses) setClasses(uniqueById(JSON.parse(savedClasses).map((entry: ClassRoom) => ({ ...entry, pin: entry.id === "room-12" ? "638214" : entry.pin, operations: entry.operations || ["multiplication", "division", "addition", "subtraction"] }))));
    if (savedStudents) setStudents(JSON.parse(savedStudents));
    const savedSession = window.localStorage.getItem("fact-friends-session");
    if (savedSession) {
      const session = JSON.parse(savedSession) as { role: Role; teacherEmail?: string; studentId?: string };
      if (session.role === "teacher" && session.teacherEmail) {
        setCurrentTeacher(session.teacherEmail);
        setRole("teacher");
      }
      if (session.role === "student" && session.studentId) {
        const savedStudent = (savedStudents ? JSON.parse(savedStudents) : demoStudents).find((entry: Student) => entry.id === session.studentId);
        if (savedStudent) {
          setStudent(savedStudent);
          setRole("student");
        }
      }
    }
    sessionLoaded.current = true;
  }, []);

  useEffect(() => { window.localStorage.setItem("fact-friends-classes", JSON.stringify(classes)); }, [classes]);
  useEffect(() => { window.localStorage.setItem("fact-friends-students", JSON.stringify(students)); }, [students]);
  useEffect(() => {
    if (!sessionLoaded.current || role !== "teacher" || !currentTeacher) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ classes: classes.filter((entry) => entry.teacherEmail === currentTeacher), students, quizzes, results, theme }) });
    }, 400);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [classes, students, quizzes, results, theme, role, currentTeacher]);
  useEffect(() => {
    if (!sessionLoaded.current || !role) return;
    window.localStorage.setItem("fact-friends-session", JSON.stringify({ role, teacherEmail: currentTeacher, studentId: student?.id }));
  }, [role, currentTeacher, student]);

  function changeTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    window.localStorage.setItem("fact-friends-theme", nextTheme);
  }

  useEffect(() => {
    if (studentView !== "quiz" || !activeQuiz || secondsLeft <= 0) return;
    const timer = window.setInterval(() => setSecondsLeft((seconds) => seconds - 1), 1000);
    return () => window.clearInterval(timer);
  }, [studentView, activeQuiz, secondsLeft]);

  useEffect(() => {
    if (studentView === "quiz" && activeQuiz && secondsLeft === 0) submitQuiz(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const username = String(data.get("username") || "").trim().toLowerCase();
    const pin = String(data.get("pin") || "").trim();
    const accountType = String(data.get("accountType") || "student");
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", accountType, username, pin }) });
      const remote = await response.json();
      if (response.ok && remote.role === "teacher") { const stateResponse = await fetch("/api/state"); const serverState = stateResponse.ok ? await stateResponse.json() : { state: null }; if (serverState.state) { setClasses((current) => [...current.filter((entry) => entry.teacherEmail !== remote.teacher.email), ...uniqueById<ClassRoom>(serverState.state.classes.map((entry: ClassRoom) => ({ ...entry, teacherEmail: remote.teacher.email })))]); setStudents(serverState.state.students || []); setQuizzes(serverState.state.quizzes || []); setResults(serverState.state.results || []); } setCurrentTeacher(remote.teacher.email); setTeachers((current) => current.some((entry) => entry.email === remote.teacher.email) ? current : [...current, { name: remote.teacher.name, email: remote.teacher.email, pin, allowIncompleteAnswers: remote.teacher.allowIncompleteAnswers }]); setRole("teacher"); setLoginError(""); return; }
      if (response.status === 300 && remote.matches?.length) { const remoteMatches = remote.matches.map((match: Student) => ({ ...match, classId: "remote", levels: { multiplication: 0, division: 1, addition: 0, subtraction: 0 } })); setLoginMatches(remoteMatches); return; }
      if (response.ok && remote.role === "student") { beginStudentLogin(remote.student); return; }
    } catch { /* Use the local demo fallback when the server is unavailable. */ }
    if (accountType === "teacher" && teachers.some((teacher) => teacher.email === username && teacher.pin === pin)) {
      setCurrentTeacher(username); setRole("teacher"); setLoginError(""); return;
    }
    if (accountType === "teacher") { setLoginError("That teacher email and PIN do not match."); return; }
    const normalizedName = normalizeLoginName(username);
    const foundClass = classes.find((entry) => entry.pin === pin && !entry.archived);
    const matches = foundClass ? students.filter((entry) => {
      const fullName = normalizeLoginName(entry.name);
      return entry.classId === foundClass.id && (studentLoginName(entry.name) === normalizedName || fullName === normalizedName);
    }) : [];
    if (matches.length === 1) { beginStudentLogin(matches[0]); return; }
    if (matches.length > 1) { setLoginMatches(matches); setLoginError(""); return; }
    setLoginError("That username and PIN do not match. Try one of the demo accounts below.");
  }

  function beginStudentLogin(found: Student) { setStudent(found); setRole("student"); setLoginMatches([]); setLoginError(""); }

  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim().toLowerCase();
    const name = String(data.get("name") || "").trim();
    const confirmedEmail = String(data.get("confirmEmail") || "").trim().toLowerCase();
    const pin = String(data.get("pin") || "");
    if (email !== confirmedEmail) { setLoginError("The email addresses do not match."); return; }
    if (!/^\d{4,6}$/.test(pin)) { setLoginError("Choose a PIN containing 4 to 6 numbers."); return; }
    if (teachers.some((teacher) => teacher.email === email)) { setLoginError("A teacher account already uses that email."); return; }
    try { const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "signup", name, email, pin }) }); const remote = await response.json(); if (!response.ok) { setLoginError(remote.error || "Unable to create account."); return; } } catch { /* The local fallback keeps the prototype usable offline. */ }
    const updatedTeachers = [...teachers, { name, email, pin, allowIncompleteAnswers: false }];
    setTeachers(updatedTeachers);
    window.localStorage.setItem("fact-friends-teachers", JSON.stringify(updatedTeachers));
    setCurrentTeacher(email); setOnboarding(true); setRole("teacher"); setLoginError("");
  }

  function startQuiz(quiz: Quiz) {
    const groups = quiz.focusMode === "student-level" ? personalizedGroups(quiz.operation, student!.levels[quiz.operation], quiz.problems, quiz.includeLowerGroups, quiz.belowLevelQuestions || 0) : quiz.factGroups;
    setActiveQuiz(quiz); setProblems(makeProblems(quiz.operation, groups));
    setAnswers(Array(quiz.problems).fill("")); setSecondsLeft(quiz.minutes * 60); setOutcome(null); setAnswerWarning(""); setStudentView("quiz");
  }

  function submitQuiz(timeExpired = false) {
    if (!activeQuiz || !student || !problems.length || outcome) return;
    const unanswered = answers.filter((answer) => answer.trim() === "").length;
    const classRoom = classes.find((entry) => entry.id === student.classId);
    const teacherAllowsIncomplete = teachers.find((entry) => entry.email === classRoom?.teacherEmail)?.allowIncompleteAnswers ?? false;
    if (unanswered && !timeExpired && !teacherAllowsIncomplete) {
      setAnswerWarning(`You still have ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}. Please answer every question before submitting.`);
      return;
    }
    const correct = problems.filter((problem, index) => Number(answers[index]) === problem.answer).length;
    const passed = (correct / problems.length) * 100 >= activeQuiz.threshold;
    const targetGroup = activeQuiz.focusMode === "student-level" ? student.levels[activeQuiz.operation] : activeQuiz.group;
    const canLevel = activeQuiz.type === "leveling" && student.levels[activeQuiz.operation] <= targetGroup;
    const leveledUp = passed && canLevel;
    const result = { quizId: activeQuiz.id, studentId: student.id, correct, total: problems.length, leveledUp, completedAt: new Date().toISOString() };
    setResults((current) => [...current.filter((item) => !(item.quizId === activeQuiz.id && item.studentId === student.id)), result]);
    if (leveledUp) {
      const nextLevel = Math.min(operationInfo(activeQuiz.operation).range[1], targetGroup + 1);
      const updated = { ...student, levels: { ...student.levels, [activeQuiz.operation]: nextLevel } };
      setStudent(updated); setStudents((current) => current.map((entry) => entry.id === student.id ? updated : entry));
    }
    setOutcome(result);
  }

  function logout() { window.localStorage.removeItem("fact-friends-session"); setRole(null); setStudent(null); setCurrentTeacher(null); setOnboarding(false); setTeacherView("home"); setStudentView("home"); setOutcome(null); setActiveQuiz(null); }

  if (!role && loginMatches.length) return <StudentPicker students={loginMatches} choose={beginStudentLogin} back={() => setLoginMatches([])} />;
  if (!role) return <LoginScreen login={login} signUp={signUp} error={loginError} clearError={() => setLoginError("")} />;
  if (role === "student" && student && !student.profileIcon) return <ProfileSetup student={student} save={(profileIcon, profileColor) => { const updated = { ...student, profileIcon, profileColor }; setStudent(updated); setStudents((current) => current.map((entry) => entry.id === student.id ? updated : entry)); }} logout={logout} />;
  if (role === "teacher" && onboarding) return <TeacherOnboarding teacherEmail={currentTeacher!} existingClasses={classes} setClasses={setClasses} setStudents={setStudents} finish={() => setOnboarding(false)} logout={logout} />;
  if (role === "teacher") return <TeacherApp teacher={teachers.find((entry) => entry.email === currentTeacher)!} setTeachers={setTeachers} classes={classes.filter((entry) => entry.teacherEmail === currentTeacher)} setClasses={setClasses} students={students} quizzes={quizzes} results={results} view={teacherView} setView={setTeacherView} setStudents={setStudents} setQuizzes={setQuizzes} setResults={setResults} theme={theme} setTheme={changeTheme} logout={logout} />;
  if (studentView === "quiz" && activeQuiz) return <div className={`theme-${theme}`}><QuizScreen quiz={activeQuiz} problems={problems} answers={answers} setAnswers={setAnswers} secondsLeft={secondsLeft} submit={() => submitQuiz()} outcome={outcome} answerWarning={answerWarning} clearWarning={() => setAnswerWarning("")} done={() => { setStudentView("home"); setActiveQuiz(null); }} logout={logout} /></div>;
  const studentOperations = classes.find((entry) => entry.id === student!.classId)?.operations || operations.map((entry) => entry.value);
  return <div className={`theme-${theme}`}><StudentApp student={student!} operationsShown={studentOperations} quizzes={quizzes} results={results} view={studentView} setView={setStudentView} startQuiz={startQuiz} logout={logout} /></div>;
}

function LoginScreen({ login, signUp, error, clearError }: { login: (event: FormEvent<HTMLFormElement>) => void; signUp: (event: FormEvent<HTMLFormElement>) => void; error: string; clearError: () => void }) {
  const [audience, setAudience] = useState<"choose" | "teacher" | "student">("choose");
  const [mode, setMode] = useState<"login" | "signup">("login");
  function changeMode(next: "login" | "signup") { setMode(next); clearError(); }
  function choose(next: "teacher" | "student") { setAudience(audience === "student" && next === "student" ? "choose" : next); setMode("login"); clearError(); }
  return <main className="login-page"><section className="login-art"><div className="brand"><span className="brand-mark">+</span> Fact Friends</div><div className="hero-copy"><p className="eyebrow">MATH FACT ADVENTURE</p><h1>Every fact is a<br/><em>little victory.</em></h1><p>Build confidence, celebrate growth, and make math practice feel good.</p></div><div className="number-cloud"><b>6 × 7</b><b>24 ÷ 3</b><b>9 + 8</b><b>14 − 6</b></div></section><section className="login-panel"><div className="login-card">{audience === "choose" ? <><p className="eyebrow">WELCOME TO FACT FRIENDS</p><h2>Who are you?</h2><p className="muted">Choose how you would like to enter the website.</p><div className="audience-options"><button type="button" onClick={() => choose("teacher")}><span>♟</span><strong>I&apos;m a teacher</strong><small>Sign in or create an account</small></button><button type="button" onClick={() => choose("student")}><span>★</span><strong>I&apos;m a student</strong><small>Sign in with your class information</small></button></div></> : audience === "student" ? <><button type="button" className="auth-back" onClick={() => choose("student")}>← Back</button><p className="eyebrow">STUDENT SIGN IN</p><h2>Ready for math?</h2><p className="muted">Use your first name, last initial, and six-digit class code.</p><form onSubmit={login}><input type="hidden" name="accountType" value="student" /><label>Your name<input name="username" autoComplete="username" placeholder="For example, Ava M" required /></label><label>Class code<input name="pin" type="password" inputMode="numeric" minLength={6} maxLength={6} placeholder="Six-digit class code" required /></label>{error && <p className="form-error">{error}</p>}<button className="primary-btn" type="submit">Student sign in <span>→</span></button></form><div className="demo-box"><strong>Try the demo</strong><p><code>Ava M / 638214</code></p></div></> : <><button type="button" className="auth-back" onClick={() => setAudience("choose")}>← Back</button><div className="auth-tabs"><button type="button" className={mode === "login" ? "active" : ""} onClick={() => changeMode("login")}>Sign in</button><button type="button" className={mode === "signup" ? "active" : ""} onClick={() => changeMode("signup")}>Sign up</button></div>{mode === "login" ? <><p className="eyebrow">TEACHER SIGN IN</p><h2>Welcome back.</h2><form onSubmit={login}><input type="hidden" name="accountType" value="teacher" /><label>Email address<input name="username" autoComplete="email" placeholder="teacher@school.org" required /></label><label>Teacher PIN<input name="pin" type="password" inputMode="numeric" required /></label>{error && <p className="form-error">{error}</p>}<button className="primary-btn" type="submit">Teacher sign in <span>→</span></button></form><div className="demo-box"><strong>Try the demo</strong><p><code>msrivera / 2468</code></p></div></> : <><p className="eyebrow">TEACHER SIGN UP</p><h2>Create your account.</h2><p className="muted">Enter your name, email twice, and choose a numeric PIN.</p><form onSubmit={signUp}><label>Your name<input name="name" autoComplete="name" placeholder="For example, Taylor Morgan" required /></label><label>Email address<input name="email" type="email" autoComplete="email" required /></label><label>Confirm email address<input name="confirmEmail" type="email" required /></label><label>Choose a PIN<input name="pin" type="password" inputMode="numeric" minLength={4} maxLength={6} required /></label>{error && <p className="form-error">{error}</p>}<button className="primary-btn" type="submit">Create account <span>→</span></button></form></>}</>}</div></section></main>;
}

function StudentPicker({ students, choose, back }: { students: Student[]; choose: (student: Student) => void; back: () => void }) {
  return <main className="simple-auth-page"><section className="simple-auth-card"><button className="auth-back" onClick={back}>← Back</button><p className="eyebrow">STUDENT SIGN IN</p><h1>Which one are you?</h1><p className="muted">Tap your picture to continue.</p><div className="student-picker">{students.map((student) => <button key={student.id} onClick={() => choose(student)}><span className="picker-avatar" style={{ background: student.profileColor || profileColors[0] }}>{student.profileIcon || student.name[0]}</span><strong>{student.name}</strong></button>)}</div></section></main>;
}

function ProfileSetup({ student, save, logout }: { student: Student; save: (icon: string, color: string) => void; logout: () => void }) {
  const [icon, setIcon] = useState(profileIcons[0]); const [color, setColor] = useState(profileColors[0]);
  return <main className="simple-auth-page"><section className="simple-auth-card profile-setup"><button className="header-sign-out" onClick={logout}>Sign out</button><p className="eyebrow">FIRST-TIME SETUP</p><h1>Choose your picture</h1><p className="muted">Pick an icon and color so you can recognize your account next time.</p><span className="setup-avatar" style={{ background: color }}>{icon}</span><h3>Choose an icon</h3><div className="icon-choices">{profileIcons.map((option) => <button className={icon === option ? "selected" : ""} onClick={() => setIcon(option)} key={option}>{option}</button>)}</div><h3>Choose a color</h3><div className="color-choices">{profileColors.map((option) => <button className={color === option ? "selected" : ""} style={{ background: option }} onClick={() => setColor(option)} key={option} />)}</div><button className="primary-btn" onClick={() => save(icon, color)}>Save my picture <span>→</span></button></section></main>;
}

function Shell({ children, label, role, title, onLogout, tabs, active, setActive }: { children: React.ReactNode; label: string; role: Role; title: string; onLogout: () => void; tabs: { id: string; label: string; icon: string }[]; active: string; setActive: (view: never) => void }) {
  return <main className="app-shell"><aside><div className="brand sidebar-brand"><span className="brand-mark">+</span> Fact Friends</div><div className="profile-pill"><span className="avatar">{label[0]}</span><div><small>{role === "teacher" ? "TEACHER" : "STUDENT"}</small><strong>{label}</strong></div></div><nav>{tabs.map((tab) => <button key={tab.id} className={active === tab.id ? "nav-active" : ""} onClick={() => setActive(tab.id as never)}><span>{tab.icon}</span>{tab.label}</button>)}</nav><button className="sign-out" onClick={onLogout}>↩ Sign out</button></aside><section className="workspace"><header><div><p className="eyebrow">{role === "teacher" ? "TEACHER DESK" : "STUDENT SPACE"}</p><h1>{title}</h1></div><div className="header-actions"><div className="header-spark">✦</div><button className="header-sign-out" onClick={onLogout}>↩ Sign out</button></div></header>{children}</section></main>;
}

function TeacherOnboarding({ teacherEmail, existingClasses, setClasses, setStudents, finish, logout }: { teacherEmail: string; existingClasses: ClassRoom[]; setClasses: React.Dispatch<React.SetStateAction<ClassRoom[]>>; setStudents: React.Dispatch<React.SetStateAction<Student[]>>; finish: () => void; logout: () => void }) {
  type DraftStudent = { name: string; levels: Record<Operation, number> };
  type DraftClass = { id: string; name: string; pin: string; operations: Operation[]; manualLevels: boolean; students: DraftStudent[] };
  const blankLevels = (): Record<Operation, number> => ({ multiplication: 0, division: 1, addition: 0, subtraction: 0 });
  const newDraftClass = (): DraftClass => ({ id: crypto.randomUUID(), name: "", pin: generateClassCode(existingClasses), operations: ["multiplication", "division", "addition", "subtraction"], manualLevels: false, students: [{ name: "", levels: blankLevels() }] });
  const [draftClasses, setDraftClasses] = useState<DraftClass[]>([newDraftClass()]);
  const isSavingRef = useRef(false);
  function updateClass(id: string, field: "name" | "pin", value: string) { setDraftClasses((current) => current.map((entry) => entry.id === id ? { ...entry, [field]: value } : entry)); }
  function updateStudent(classId: string, index: number, value: string) { setDraftClasses((current) => current.map((entry) => entry.id === classId ? { ...entry, students: entry.students.map((student, studentIndex) => studentIndex === index ? { ...student, name: value } : student) } : entry)); }
  function updateLevel(classId: string, studentIndex: number, operation: Operation, level: number) { setDraftClasses((current) => current.map((entry) => entry.id === classId ? { ...entry, students: entry.students.map((student, index) => index === studentIndex ? { ...student, levels: { ...student.levels, [operation]: level } } : student) } : entry)); }
  function toggleOperation(classId: string, operation: Operation) { setDraftClasses((current) => current.map((entry) => entry.id === classId ? { ...entry, operations: entry.operations.includes(operation) ? entry.operations.filter((item) => item !== operation) : [...entry.operations, operation] } : entry)); }
  function addClass() { setDraftClasses((current) => [...current, newDraftClass()]); }
  async function complete() { if (isSavingRef.current) return; isSavingRef.current = true; const reserved = [...existingClasses]; const newClasses = draftClasses.map((entry) => { const pin = generateClassCode(reserved); const classRoom = { id: entry.id, name: entry.name.trim() || "Default", pin, archived: false, teacherEmail, operations: entry.operations.length ? entry.operations : ["multiplication", "division", "addition", "subtraction"] as Operation[] }; reserved.push(classRoom); return classRoom; }); const newStudents = draftClasses.flatMap((entry) => entry.students.filter((student) => student.name.trim()).map((student) => ({ id: crypto.randomUUID(), name: student.name.trim(), classId: entry.id, levels: entry.manualLevels ? student.levels : blankLevels() }))); const allClasses = [...existingClasses.filter((entry) => entry.teacherEmail !== teacherEmail), ...newClasses]; const allStudents = newStudents; const response = await fetch("/api/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ classes: allClasses, students: allStudents, quizzes: [], results: [], theme: "playful" }) }); if (!response.ok) { isSavingRef.current = false; window.alert("The class could not be saved to the shared account. Please try again."); return; } setClasses((current) => [...current.filter((entry) => entry.teacherEmail !== teacherEmail), ...newClasses]); setStudents(allStudents); finish(); }
  return <main className="onboarding-page"><header><div className="brand"><span className="brand-mark">+</span> Fact Friends</div><button className="header-sign-out" onClick={logout}>Sign out</button></header><section className="onboarding-content"><p className="eyebrow">WELCOME TO FACT FRIENDS</p><h1>Set up your classes</h1><p className="onboarding-lead">Choose the math operations for each class, then add students and optionally set their starting levels.</p><div className="onboarding-classes">{draftClasses.map((classRoom, classIndex) => <section className="onboarding-class panel" key={classRoom.id}><div className="onboarding-class-title"><span>{classIndex + 1}</span><h2>Class details</h2>{draftClasses.length > 1 && <button onClick={() => setDraftClasses((current) => current.filter((entry) => entry.id !== classRoom.id))}>Remove class</button>}</div><div className="form-grid"><label>Class name<input value={classRoom.name} onChange={(event) => updateClass(classRoom.id, "name", event.target.value)} placeholder="For example, Room 12 Math Stars" /></label><label>System-generated class code<input value={classRoom.pin} readOnly /></label></div><div className="onboarding-operations"><h3>Arithmetic operations</h3><p>Only selected operations will appear for this class.</p><div>{operations.map((operation) => <label key={operation.value}><input type="checkbox" checked={classRoom.operations.includes(operation.value)} onChange={() => toggleOperation(classRoom.id, operation.value)} /><span className={`op-icon ${operation.color}`}>{operation.symbol}</span>{operation.label}</label>)}</div><label className="manual-level-toggle"><input type="checkbox" checked={classRoom.manualLevels} onChange={(event) => setDraftClasses((current) => current.map((entry) => entry.id === classRoom.id ? { ...entry, manualLevels: event.target.checked } : entry))} /> Set each student&apos;s starting levels manually</label></div><div className="onboarding-roster"><h3>Students</h3><p>Students will sign in with their first name, last initial, and class PIN.</p>{classRoom.students.map((student, index) => <div className="onboarding-student-wrap" key={index}><div className="onboarding-student"><span>{index + 1}</span><input value={student.name} onChange={(event) => updateStudent(classRoom.id, index, event.target.value)} placeholder="Student's first and last name" />{classRoom.students.length > 1 && <button onClick={() => setDraftClasses((current) => current.map((entry) => entry.id === classRoom.id ? { ...entry, students: entry.students.filter((_, studentIndex) => studentIndex !== index) } : entry))}>×</button>}</div>{classRoom.manualLevels && <div className="student-level-inputs">{operations.filter((operation) => classRoom.operations.includes(operation.value)).map((operation) => <label key={operation.value}><span>{operation.label}</span><input type="number" min={operation.range[0]} max={operation.range[1]} value={student.levels[operation.value]} onChange={(event) => updateLevel(classRoom.id, index, operation.value, Number(event.target.value))} /></label>)}</div>}</div>)}<button className="text-btn" onClick={() => setDraftClasses((current) => current.map((entry) => entry.id === classRoom.id ? { ...entry, students: [...entry.students, { name: "", levels: blankLevels() }] } : entry))}>＋ Add another student</button></div></section>)}</div><div className="onboarding-actions"><button className="secondary-btn" onClick={addClass}>＋ Add another class</button><button className="primary-btn" onClick={complete}>Finish setup <span>→</span></button></div></section></main>;
}

function TeacherApp({ teacher, setTeachers, classes, setClasses, students, quizzes, results, view, setView, setStudents, setQuizzes, setResults, theme, setTheme, logout }: { teacher: TeacherAccount; setTeachers: React.Dispatch<React.SetStateAction<TeacherAccount[]>>; classes: ClassRoom[]; setClasses: React.Dispatch<React.SetStateAction<ClassRoom[]>>; students: Student[]; quizzes: Quiz[]; results: Result[]; view: string; setView: (view: "home" | "students" | "create" | "quizzes" | "results" | "settings") => void; setStudents: React.Dispatch<React.SetStateAction<Student[]>>; setQuizzes: React.Dispatch<React.SetStateAction<Quiz[]>>; setResults: React.Dispatch<React.SetStateAction<Result[]>>; theme: Theme; setTheme: (theme: Theme) => void; logout: () => void }) {
  const activeClasses = classes.filter((entry) => !entry.archived);
  const [classId, setClassId] = useState(activeClasses[0]?.id || "");
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const navigate = useHistoryState("teacherView", view, setView as Dispatch<SetStateAction<string>>);
  if (!activeClasses.length) return <TeacherOnboarding teacherEmail={teacher.email} existingClasses={classes} setClasses={setClasses} setStudents={setStudents} finish={() => window.location.reload()} logout={logout} />;
  const activeClass = activeClasses.find((entry) => entry.id === classId) || activeClasses[0];
  const classStudents = students.filter((entry) => entry.classId === activeClass.id);
  const classQuizzes = quizzes.filter((entry) => entry.classId === activeClass.id);
  const classResults = results.filter((result) => classStudents.some((entry) => entry.id === result.studentId));
  const titles = { home: `Good morning, !`, students: "Your learners", create: "Create a quiz", quizzes: "Assigned quizzes", results: "Quiz results", settings: "Settings" };
  return <div className={`theme-${theme}`}><Shell label={teacher.name} role="teacher" title={titles[view as keyof typeof titles]} onLogout={logout} active={view} setActive={navigate as never} tabs={[{ id: "home", label: "Overview", icon: "⌂" }, { id: "students", label: "Students", icon: "♙" }, { id: "create", label: "Create quiz", icon: "＋" }, { id: "quizzes", label: "Quizzes", icon: "▤" }, { id: "results", label: "Results", icon: "◒" }, { id: "settings", label: "Settings", icon: "⚙" }]}>
    <ClassSwitcher classes={activeClasses} activeClass={activeClass} setClassId={setClassId} setClasses={setClasses} students={students} setStudents={setStudents} setQuizzes={setQuizzes} setResults={setResults} />
    {view === "home" && <TeacherOverview classRoom={activeClass} students={classStudents} quizzes={classQuizzes} results={classResults} setView={navigate as (view: "create") => void} />}
    {view === "students" && <StudentsPanel classRoom={activeClass} students={classStudents} quizzes={classQuizzes} results={classResults} setStudents={setStudents} initialStudentId={selectedStudentId} clearInitialStudent={() => setSelectedStudentId(null)} openQuiz={(quizId) => { setSelectedQuizId(quizId); navigate("quizzes"); }} />}
    {view === "create" && <CreateQuizHub classRoom={activeClass} students={classStudents} quizzes={classQuizzes} setQuizzes={setQuizzes} setView={setView} />}
    {view === "quizzes" && <QuizDashboard classRoom={activeClass} students={classStudents} quizzes={classQuizzes} results={classResults} initialQuizId={selectedQuizId} clearInitialQuiz={() => setSelectedQuizId(null)} openStudent={(studentId) => { setSelectedStudentId(studentId); navigate("students"); }} />}
    {view === "results" && <ResultsPanel students={classStudents} quizzes={classQuizzes} results={classResults} />}
    {view === "settings" && <SettingsPanel teacher={teacher} setTeachers={setTeachers} theme={theme} setTheme={setTheme} classes={classes} setClasses={setClasses} students={students} setStudents={setStudents} quizzes={quizzes} setQuizzes={setQuizzes} results={results} setResults={setResults} logout={logout} />}
  </Shell></div>;
}

function ClassSwitcher({ classes, activeClass, setClassId, setClasses, students, setStudents, setQuizzes, setResults }: { classes: ClassRoom[]; activeClass: ClassRoom; setClassId: (id: string) => void; setClasses: React.Dispatch<React.SetStateAction<ClassRoom[]>>; students: Student[]; setStudents: React.Dispatch<React.SetStateAction<Student[]>>; setQuizzes: React.Dispatch<React.SetStateAction<Quiz[]>>; setResults: React.Dispatch<React.SetStateAction<Result[]>> }) {
  function addClass() { const name = window.prompt("What is the new class name?"); if (!name) return; const classRoom = { id: crypto.randomUUID(), name, pin: generateClassCode(classes), archived: false, teacherEmail: activeClass.teacherEmail, operations: ["multiplication", "division", "addition", "subtraction"] as Operation[] }; setClasses((current) => [...current, classRoom]); setClassId(classRoom.id); }
  function renameClass() { const name = window.prompt("Update the class name:", activeClass.name); if (name) setClasses((current) => current.map((entry) => entry.id === activeClass.id ? { ...entry, name } : entry)); }
  function archiveClass() { if (classes.length === 1 || !window.confirm(`Archive ${activeClass.name}? Students will no longer be able to sign in.`)) return; const next = classes.find((entry) => entry.id !== activeClass.id)!; setClasses((current) => current.map((entry) => entry.id === activeClass.id ? { ...entry, archived: true } : entry)); setClassId(next.id); }
  function deleteClass() { if (classes.length === 1 || !window.confirm(`Permanently delete ${activeClass.name}? This will remove its students, quizzes, and results and cannot be undone.`)) return; const next = classes.find((entry) => entry.id !== activeClass.id)!; const studentIds = new Set(students.filter((entry) => entry.classId === activeClass.id).map((entry) => entry.id)); setClasses((current) => current.filter((entry) => entry.id !== activeClass.id)); setStudents((current) => current.filter((entry) => entry.classId !== activeClass.id)); setQuizzes((current) => current.filter((entry) => entry.classId !== activeClass.id)); setResults((current) => current.filter((entry) => !studentIds.has(entry.studentId))); setClassId(next.id); }
  return <section className="class-switcher"><label>Viewing class<select value={activeClass.id} onChange={(event) => setClassId(event.target.value)}>{classes.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select></label><span>Class PIN <code>{activeClass.pin}</code></span><button onClick={addClass}>＋ New class</button><details className="class-menu"><summary>Class options <span>⌄</span></summary><div><button onClick={renameClass}>Edit name</button><button onClick={archiveClass} disabled={classes.length === 1}>Archive class</button><button className="delete-class" onClick={deleteClass} disabled={classes.length === 1}>Delete class</button></div></details></section>;
}

function TeacherOverview({ classRoom, students, quizzes, results, setView }: { classRoom: ClassRoom; students: Student[]; quizzes: Quiz[]; results: Result[]; setView: (view: "create") => void }) {
  const assigned = quizzes.filter((quiz) => quiz.status === "assigned").reduce((total, quiz) => total + quiz.assignedTo.length, 0);
  return <div className="content-stack"><section className="welcome-banner"><div><p className="eyebrow">{classRoom.name.toUpperCase()} · MONDAY</p><h2>Your math crew is ready to grow.</h2><p>Create a quick fact quiz or check in on today&apos;s progress.</p><button className="light-btn" onClick={() => setView("create")}>Create a quiz <span>→</span></button></div><div className="banner-mascot">✦<span>7</span><i>+</i></div></section><section className="stat-grid"><Stat number={String(students.length)} label="Students in your class" color="violet" /><Stat number={String(assigned)} label="Quizzes assigned" color="orange" /><Stat number={String(results.length)} label="Quizzes completed" color="sky" /></section></div>;
}

function Stat({ number, label, color }: { number: string; label: string; color: string }) { return <div className={`stat-card ${color}`}><strong>{number}</strong><span>{label}</span></div>; }

function SettingsPanel({ teacher, setTeachers, theme, setTheme, classes, setClasses, students, setStudents, quizzes, setQuizzes, results, setResults, logout }: { teacher: TeacherAccount; setTeachers: React.Dispatch<React.SetStateAction<TeacherAccount[]>>; theme: Theme; setTheme: (theme: Theme) => void; classes: ClassRoom[]; setClasses: React.Dispatch<React.SetStateAction<ClassRoom[]>>; students: Student[]; setStudents: React.Dispatch<React.SetStateAction<Student[]>>; quizzes: Quiz[]; setQuizzes: React.Dispatch<React.SetStateAction<Quiz[]>>; results: Result[]; setResults: React.Dispatch<React.SetStateAction<Result[]>>; logout: () => void }) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [name, setName] = useState(teacher.name);
  const archived = classes.filter((entry) => entry.archived);
  const themes: { id: Theme; label: string; colors: string[] }[] = [
    { id: "playful", label: "Playful", colors: ["#7456e8", "#f5b84b", "#45b7b8"] },
    { id: "red", label: "Red", colors: ["#b42332"] },
    { id: "orange", label: "Orange", colors: ["#c75b18"] },
    { id: "yellow", label: "Yellow", colors: ["#a16b00"] },
    { id: "green", label: "Green", colors: ["#26734d"] },
    { id: "blue", label: "Blue", colors: ["#2563a9"] },
    { id: "purple", label: "Purple", colors: ["#6941a5"] },
    { id: "mono", label: "Black & white", colors: ["#222222", "#ffffff"] },
  ];
  const previewClass = archived.find((entry) => entry.id === previewId);
  function updateTeacher(changes: Partial<TeacherAccount>) { setTeachers((current) => { const updated = current.map((entry) => entry.email === teacher.email ? { ...entry, ...changes } : entry); window.localStorage.setItem("fact-friends-teachers", JSON.stringify(updated)); return updated; }); }
  function saveName(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const trimmed = name.trim(); if (trimmed) updateTeacher({ name: trimmed }); }
  function toggleLevelBadge(classRoom: ClassRoom, operation: Operation) { const selected = classRoom.operations.includes(operation); if (!selected) { const lowestLevel = operationInfo(operation).range[0]; setStudents((current) => current.map((student) => student.classId === classRoom.id ? { ...student, levels: { ...student.levels, [operation]: lowestLevel } } : student)); } setClasses((current) => current.map((entry) => { if (entry.id !== classRoom.id || (selected && entry.operations.length === 1)) return entry; return { ...entry, operations: selected ? entry.operations.filter((item) => item !== operation) : [...entry.operations, operation] }; })); }
  function setLevelStyle(classRoom: ClassRoom, operation: Operation, style: "number" | "letter") { const info = operationInfo(operation); const labels = Object.fromEntries(Array.from({ length: info.range[1] - info.range[0] + 1 }, (_, index) => { const group = info.range[0] + index; return [String(group), defaultLevelLabel(operation, group, style)]; })); setClasses((current) => current.map((entry) => entry.id === classRoom.id ? { ...entry, levelFormats: { ...entry.levelFormats, [operation]: { style, labels } } } : entry)); }
  function setLevelMapping(classRoom: ClassRoom, operation: Operation, group: number, label: string) { const existing = classRoom.levelFormats?.[operation]; setClasses((current) => current.map((entry) => entry.id === classRoom.id ? { ...entry, levelFormats: { ...entry.levelFormats, [operation]: { style: existing?.style || "number", labels: { ...existing?.labels, [String(group)]: label } } } } : entry)); }
  function deleteAccount() { if (!window.confirm(`Permanently delete ’s account and all classroom data? This cannot be undone.`)) return; const classIds = new Set(classes.map((entry) => entry.id)); const studentIds = new Set(students.filter((entry) => classIds.has(entry.classId)).map((entry) => entry.id)); setTeachers((current) => { const updated = current.filter((entry) => entry.email !== teacher.email); window.localStorage.setItem("fact-friends-teachers", JSON.stringify(updated)); return updated; }); setClasses((current) => current.filter((entry) => !classIds.has(entry.id))); setStudents((current) => current.filter((entry) => !studentIds.has(entry.id))); setQuizzes((current) => current.filter((entry) => !classIds.has(entry.classId))); setResults((current) => current.filter((entry) => !studentIds.has(entry.studentId))); logout(); }
  return <div className="settings-page"><section className="settings-category"><h2>Profile + Display</h2><section className="account-preferences panel"><div><p className="eyebrow">PROFILE</p><h3>Teacher settings</h3></div><form onSubmit={saveName}><label>Display name<input value={name} onChange={(event) => setName(event.target.value)} required /></label><button className="secondary-btn" type="submit">Save name</button></form></section><section className="settings-intro"><p className="eyebrow">APPEARANCE</p><h3>Choose how Fact Friends looks</h3><p>Select a clean single-color style or keep the current playful palette.</p></section><section className="theme-grid">{themes.map((option) => <button className={theme === option.id ? "theme-card selected" : "theme-card"} onClick={() => setTheme(option.id)} key={option.id}><span className="theme-swatches">{option.colors.map((color) => <i style={{ background: color }} key={color} />)}</span><span><strong>{option.label}</strong></span><b>{theme === option.id ? "✓" : ""}</b></button>)}</section></section><section className="settings-category"><h2>Advanced</h2><section className="advanced-settings panel"><div><p className="eyebrow">QUIZ SUBMISSION</p><h3>Quiz submission rules</h3></div><label className="submission-setting"><input type="checkbox" checked={teacher.allowIncompleteAnswers} onChange={(event) => updateTeacher({ allowIncompleteAnswers: event.target.checked })} /><span><strong>Allow incomplete quiz submissions</strong><small>Students can submit while one or more answers are blank.</small></span></label></section><section className="badge-settings panel"><div><p className="eyebrow">LEVEL BADGES</p><h3>Choose visible arithmetic levels</h3><p>Select the operation badges shown for students in each active class.</p></div>{classes.filter((entry) => !entry.archived).map((classRoom) => <div className="badge-class" key={classRoom.id}><strong>{classRoom.name}</strong><div>{operations.map((operation) => <label key={operation.value}><input type="checkbox" checked={classRoom.operations.includes(operation.value)} onChange={() => toggleLevelBadge(classRoom, operation.value)} /><span className={`op-icon ${operation.color}`}>{operation.symbol}</span>{operation.label}</label>)}</div></div>)}</section><section className="level-format-settings panel"><div><p className="eyebrow">LEVEL NAMES</p><h3>Customize level labels</h3><p>Choose numbers or letters, then map each label to a fact group.</p></div>{classes.filter((entry) => !entry.archived).map((classRoom) => <div className="level-format-class" key={classRoom.id}><h3>{classRoom.name}</h3>{classRoom.operations.map((operation) => { const info = operationInfo(operation); const format = classRoom.levelFormats?.[operation]; return <details key={operation}><summary><span className={`op-icon ${info.color}`}>{info.symbol}</span>{info.label}<span>{format?.style === "letter" ? "Letters" : "Numbers"}</span></summary><div className="level-format-controls"><label>Level style<select value={format?.style || "number"} onChange={(event) => setLevelStyle(classRoom, operation, event.target.value as "number" | "letter")}><option value="number">Numbers</option><option value="letter">Letters</option></select></label><div className="level-mapping-grid">{Array.from({ length: info.range[1] - info.range[0] + 1 }, (_, index) => info.range[0] + index).map((group) => <label key={group}><span>Fact group {group}</span><input value={levelLabel(classRoom, operation, group)} onChange={(event) => setLevelMapping(classRoom, operation, group, event.target.value)} maxLength={8} /></label>)}</div></div></details>; })}</div>)}</section></section><section className="settings-category"><h2>Class Management</h2><section className="archived-section"><div><p className="eyebrow">ARCHIVED CLASSES</p><h3>Archived classes</h3></div>{archived.length === 0 ? <div className="archived-empty">No archived classes</div> : archived.map((classRoom) => { const classStudents = students.filter((entry) => entry.classId === classRoom.id); return <div className="archived-row" key={classRoom.id}><div><strong>{classRoom.name}</strong><small>{classStudents.length} students · PIN {classRoom.pin}</small></div><button onClick={() => setPreviewId(classRoom.id)}>Preview class</button><button className="restore-btn" onClick={() => setClasses((current) => current.map((entry) => entry.id === classRoom.id ? { ...entry, archived: false } : entry))}>Restore class</button></div>; })}</section><section className="danger-zone"><div><p className="eyebrow">ACCOUNT</p><h3>Delete teacher account</h3><p>Permanently remove your account and all of its classes, students, quizzes, and results.</p></div><button onClick={deleteAccount}>Delete my account</button></section></section>{previewClass && <ArchivedClassPreview classRoom={previewClass} students={students.filter((entry) => entry.classId === previewClass.id)} quizzes={quizzes.filter((entry) => entry.classId === previewClass.id)} results={results} close={() => setPreviewId(null)} />}</div>;
}

function ArchivedClassPreview({ classRoom, students, quizzes, results, close }: { classRoom: ClassRoom; students: Student[]; quizzes: Quiz[]; results: Result[]; close: () => void }) {
  const completed = results.filter((result) => students.some((student) => student.id === result.studentId)).length;
  return <div className="preview-backdrop archived-preview-backdrop" role="dialog" aria-modal="true" aria-label={`Archived preview of ${classRoom.name}`}><section className="archived-preview"><div className="archived-preview-header"><div><p className="eyebrow">ARCHIVED · READ ONLY</p><h2>{classRoom.name}</h2><p>This is an uneditable preview of the archived class.</p></div><button className="preview-close" onClick={close}>×</button></div><div className="stat-grid"><Stat number={String(students.length)} label="Students" color="violet" /><Stat number={String(quizzes.length)} label="Quizzes" color="orange" /><Stat number={String(completed)} label="Completed" color="sky" /></div><section className="panel"><p className="eyebrow">CLASS ROSTER</p>{students.length === 0 ? <p className="archived-empty">No students in this class</p> : students.map((student) => <div className="progress-row" key={student.id}><span className="avatar small-avatar">{student.name[0]}</span><div className="progress-name"><strong>{student.name}</strong><small>Multiplication level {student.levels.multiplication}</small></div></div>)}</section><button className="secondary-btn" onClick={close}>Close preview</button></section></div>;
}

function StudentsPanel({ classRoom, students, quizzes, results, setStudents, initialStudentId, clearInitialStudent, openQuiz }: { classRoom: ClassRoom; students: Student[]; quizzes: Quiz[]; results: Result[]; setStudents: React.Dispatch<React.SetStateAction<Student[]>>; initialStudentId: string | null; clearInitialStudent: () => void; openQuiz: (quizId: string) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(initialStudentId);
  const navigateStudent = useHistoryState("studentDetail", studentId, setStudentId);
  useEffect(() => { if (initialStudentId) { setStudentId(initialStudentId); clearInitialStudent(); } }, [initialStudentId, clearInitialStudent]);
  function addStudent(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); const name = String(data.get("name")); setStudents((current) => [...current, { id: crypto.randomUUID(), name, classId: classRoom.id, levels: { multiplication: 0, division: 1, addition: 0, subtraction: 0 } }]); setShowAdd(false); }
  function overrideLevel(student: Student, operation: Operation) { const info = operationInfo(operation); const value = window.prompt(`Set ${student.name}'s ${info.label.toLowerCase()} level (${info.range[0]}–${info.range[1]}):`, String(student.levels[operation])); if (value === null) return; const level = Number(value); if (!Number.isInteger(level) || level < info.range[0] || level > info.range[1]) { window.alert(`Enter a whole number from ${info.range[0]} to ${info.range[1]}.`); return; } setStudents((current) => current.map((entry) => entry.id === student.id ? { ...entry, levels: { ...entry.levels, [operation]: level } } : entry)); }
  const selected = students.find((entry) => entry.id === studentId);
  if (selected) return <StudentDetail student={selected} classRoom={classRoom} operationsShown={classRoom.operations} quizzes={quizzes} results={results} back={() => navigateStudent(null)} openQuiz={openQuiz} />;
  return <div className="content-stack"><section className="class-bar"><div><p className="eyebrow">YOUR CLASS · PIN {classRoom.pin}</p><h2>{classRoom.name} <span>{students.length} learners</span></h2></div><button className="primary-btn compact" onClick={() => setShowAdd(!showAdd)}>＋ Add learner</button></section>{showAdd && <form className="add-form simple-add" onSubmit={addStudent}><label>Student name<input name="name" placeholder="Student's first and last name" required /><small>Student login: first name + last initial, such as <code>JordanS</code></small></label><button className="primary-btn compact">Add to class</button></form>}<section className="panel student-table"><div className="table-head"><span>Learner</span>{operations.filter((operation) => classRoom.operations.includes(operation.value)).map((operation) => <span key={operation.value}>{operation.label}</span>)}<span>Login</span></div>{students.map((entry) => { const [first, last = ""] = entry.name.split(" "); return <div className="table-row student-row-button" onClick={() => navigateStudent(entry.id)} key={entry.id}><div className="student-name"><span className="avatar small-avatar">{entry.name[0]}</span><div><strong>{entry.name}</strong><small>{first} {last[0] || ""}</small></div></div>{operations.filter((operation) => classRoom.operations.includes(operation.value)).map((operation) => <button className={`level-chip editable-level ${operation.color}`} onClick={(event) => { event.stopPropagation(); overrideLevel(entry, operation.value); }} title={`Change ${operation.label.toLowerCase()} level`} key={operation.value}>Level {levelLabel(classRoom, operation.value, entry.levels[operation.value])}</button>)}<code>{classRoom.pin}</code></div>; })}</section></div>;
}

function StudentDetail({ student, classRoom, operationsShown, quizzes, results, back, openQuiz }: { student: Student; classRoom: ClassRoom; operationsShown: Operation[]; quizzes: Quiz[]; results: Result[]; back: () => void; openQuiz: (quizId: string) => void }) {
  const completed = results.filter((result) => result.studentId === student.id);
  const average = completed.length ? Math.round(completed.reduce((total, result) => total + result.correct / result.total * 100, 0) / completed.length) : 0;
  const levelUps = completed.filter((result) => result.leveledUp).length;
  return <div className="content-stack student-detail"><button className="back-link" onClick={back}>← All students</button><section className="student-detail-hero"><span className="avatar student-avatar">{student.name[0]}</span><div><p className="eyebrow">STUDENT PROFILE</p><h2>{student.name}</h2><p>Quiz progress and fact mastery</p></div></section><section><div className="section-title"><div><p className="eyebrow">CURRENT MASTERY</p><h2>Fact levels</h2></div></div><div className="level-card-grid">{operations.filter((operation) => operationsShown.includes(operation.value)).map((operation) => <div className="level-card" key={operation.value}><span className={`op-icon ${operation.color}`}>{operation.symbol}</span><div><small>{operation.label}</small><strong>Level {levelLabel(classRoom, operation.value, student.levels[operation.value])}</strong></div></div>)}</div></section><section className="stat-grid"><Stat number={String(completed.length)} label="Quizzes completed" color="violet" /><Stat number={completed.length ? `${average}%` : "—"} label="Average score" color="sky" /><Stat number={String(levelUps)} label="Levels earned" color="orange" /></section><section className="panel student-quiz-history"><div className="panel-heading"><div><p className="eyebrow">QUIZ HISTORY</p><h3>Completed quizzes</h3></div></div>{completed.length === 0 ? <div className="empty-state"><span>◒</span><p>This student has not completed a quiz yet.</p></div> : completed.slice().reverse().map((result) => { const quiz = quizzes.find((entry) => entry.id === result.quizId); const percent = Math.round(result.correct / result.total * 100); return <button className="student-history-row" onClick={() => quiz && openQuiz(quiz.id)} disabled={!quiz} key={`${result.quizId}-${result.completedAt}`}><span className={`op-icon ${quiz ? operationInfo(quiz.operation).color : "violet"}`}>{quiz ? operationInfo(quiz.operation).symbol : "?"}</span><div><strong>{quiz?.title || "Quiz no longer available"}</strong><small>{dateLabel(result.completedAt)} · {quiz?.type}</small></div><b>{result.correct}/{result.total}</b><span className={quiz && percent >= quiz.threshold ? "status-pass" : "status-try"}>{percent}%</span><i>→</i></button>; })}</section></div>;
}

function CreateQuizHub({ classRoom, students, quizzes, setQuizzes, setView }: { classRoom: ClassRoom; students: Student[]; quizzes: Quiz[]; setQuizzes: React.Dispatch<React.SetStateAction<Quiz[]>>; setView: (view: "home") => void }) {
  const [page, setPage] = useState<"menu" | "builder" | "drafts">("menu");
  const navigatePage = useHistoryState("createPage", page, setPage);
  const [editingDraft, setEditingDraft] = useState<Quiz | null>(null);
  const drafts = quizzes.filter((quiz) => quiz.status === "draft");
  if (page === "builder") return <div className="content-stack"><button className="back-link" onClick={() => { setEditingDraft(null); navigatePage("menu"); }}>← Create quiz</button><QuizBuilder classId={classRoom.id} levelOperations={classRoom.operations} students={students} setQuizzes={setQuizzes} setView={setView} draft={editingDraft} /></div>;
  if (page === "drafts") return <DraftQuizPage classRoom={classRoom} students={students} drafts={drafts} setQuizzes={setQuizzes} editDraft={(draft) => { setEditingDraft(draft); navigatePage("builder"); }} back={() => navigatePage("menu")} />;
  return <div className="create-hub"><section className="create-hub-intro"><p className="eyebrow">{classRoom.name.toUpperCase()}</p><h2>What would you like to do?</h2><p>Build a new quiz or manage quizzes you previously saved.</p></section><section className="create-option-grid"><button className="create-option" onClick={() => navigatePage("builder")}><span>＋</span><div><h3>Create a new quiz</h3><p>Choose operations, fact groups, timing, and students.</p></div></button><button className="create-option" onClick={() => navigatePage("drafts")}><span>✎</span><div><h3>Draft quizzes</h3><p>Review and launch quizzes you have saved for later.</p></div><em>{drafts.length}</em></button></section></div>;
}

function DraftQuizPage({ classRoom, students, drafts, setQuizzes, editDraft, back }: { classRoom: ClassRoom; students: Student[]; drafts: Quiz[]; setQuizzes: React.Dispatch<React.SetStateAction<Quiz[]>>; editDraft: (draft: Quiz) => void; back: () => void }) {
  const [selectedDrafts, setSelectedDrafts] = useState<string[]>([]);
  function launchDrafts() { if (!selectedDrafts.length) return; const now = new Date().toISOString(); setQuizzes((current) => current.map((quiz) => selectedDrafts.includes(quiz.id) ? { ...quiz, status: "assigned", assignedAt: now, assignedTo: students.map((student) => student.id) } : quiz)); setSelectedDrafts([]); }
  function deleteDraft(id: string, title: string) { if (!window.confirm(`Delete the draft “${title}”? This cannot be undone.`)) return; setQuizzes((current) => current.filter((quiz) => quiz.id !== id)); setSelectedDrafts((current) => current.filter((draftId) => draftId !== id)); }
  return <div className="content-stack"><button className="back-link" onClick={back}>← Create quiz</button><section className="draft-page-heading"><div><p className="eyebrow">{classRoom.name.toUpperCase()}</p><h2>Draft quizzes</h2><p>Select one or more drafts to assign them to the whole class.</p></div><button className="primary-btn compact" disabled={!selectedDrafts.length || !students.length} onClick={launchDrafts}>Launch selected ({selectedDrafts.length})</button></section><section className="draft-section panel">{drafts.length === 0 ? <div className="empty-state"><span>✎</span><h3>No draft quizzes</h3><p>Quizzes saved as drafts will appear on this page.</p></div> : <div className="draft-list"><label className="select-all"><input type="checkbox" checked={selectedDrafts.length === drafts.length} onChange={(event) => setSelectedDrafts(event.target.checked ? drafts.map((draft) => draft.id) : [])} /> Select all drafts</label>{drafts.map((draft) => <div className={selectedDrafts.includes(draft.id) ? "draft-row selected" : "draft-row"} key={draft.id}><input aria-label={`Select ${draft.title}`} type="checkbox" checked={selectedDrafts.includes(draft.id)} onChange={() => setSelectedDrafts((current) => current.includes(draft.id) ? current.filter((id) => id !== draft.id) : [...current, draft.id])} /><span className={`op-icon ${operationInfo(draft.operation).color}`}>{operationInfo(draft.operation).symbol}</span><div><strong>{draft.title}</strong><small>{operationInfo(draft.operation).label} · {draft.problems} questions · {draft.type}</small></div><span className="draft-badge">Draft</span><button className="edit-draft" onClick={() => editDraft(draft)}>Edit</button><button className="delete-draft" onClick={() => deleteDraft(draft.id, draft.title)}>Delete</button></div>)}</div>}<p className="launch-note">Launching selected drafts assigns each quiz to every student currently in {classRoom.name}.</p></section></div>;
}

function QuizBuilder({ classId, levelOperations, students, setQuizzes, setView, draft }: { classId: string; levelOperations: Operation[]; students: Student[]; setQuizzes: React.Dispatch<React.SetStateAction<Quiz[]>>; setView: (view: "home") => void; draft: Quiz | null }) {
  const [operation, setOperation] = useState<Operation>(draft?.operation || "multiplication"); const [type, setType] = useState<QuizType>(draft?.type || "leveling"); const [focusMode, setFocusMode] = useState<"selected" | "student-level">(draft?.focusMode || "selected"); const [includeLower, setIncludeLower] = useState(draft?.includeLowerGroups || false); const [belowLevelQuestions, setBelowLevelQuestions] = useState(draft?.belowLevelQuestions || 5); const [weeklyQuestions, setWeeklyQuestions] = useState(draft?.problems || 20); const [groups, setGroups] = useState<{ group: number; questions: number }[]>(draft?.factGroups || [{ group: 5, questions: 10 }]); const [selected, setSelected] = useState<string[]>(draft?.assignedTo.length ? draft.assignedTo : students.map((entry) => entry.id)); const [preview, setPreview] = useState<Problem[] | null>(null);
  const info = operationInfo(operation);
  const canLevel = levelOperations.includes(operation);
  useEffect(() => { if (!draft || operation !== draft.operation) setGroups([{ group: operationInfo(operation).range[0], questions: 10 }]); }, [operation, draft]);
  useEffect(() => { if (!canLevel) setType("practice"); }, [canLevel]);
  const totalQuestions = focusMode === "student-level" ? weeklyQuestions : groups.reduce((total, item) => total + item.questions, 0);
  function toggleGroup(group: number) { setGroups((current) => current.some((item) => item.group === group) ? current.filter((item) => item.group !== group) : [...current, { group, questions: 1 }]); }
  function changeQuestions(group: number, questions: number) { setGroups((current) => current.map((item) => item.group === group ? { ...item, questions: Math.max(1, questions || 1) } : item)); }
  function createQuiz(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if ((focusMode === "selected" && !groups.length) || totalQuestions > 150) return; const data = new FormData(event.currentTarget); const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null; const isDraft = submitter?.value === "draft"; const title = String(data.get("title")); const quiz: Quiz = { id: draft?.id || crypto.randomUUID(), classId, status: isDraft ? "draft" : "assigned", assignedAt: isDraft ? null : new Date().toISOString(), title: title || `${info.label} practice`, operation, group: groups[0].group, factGroups: groups, focusMode, includeLowerGroups: includeLower, belowLevelQuestions: includeLower ? belowLevelQuestions : 0, type, problems: totalQuestions, minutes: Number(data.get("minutes")), threshold: Number(data.get("threshold")), showScore: data.get("showScore") === "on", passMessage: String(data.get("passMessage")), failMessage: String(data.get("failMessage")), levelMessage: String(data.get("levelMessage")), assignedTo: isDraft ? [] : selected }; setQuizzes((current) => draft ? current.map((entry) => entry.id === draft.id ? quiz : entry) : [...current, quiz]); setView("home"); }
  return <><form className="builder" onSubmit={createQuiz}><section className="panel builder-section"><p className="eyebrow">1 · THE BASICS</p><div className="form-grid"><label>Quiz name<input name="title" defaultValue={draft?.title || "Multiply by 5"} /></label><label>Operation<select value={operation} onChange={(event) => setOperation(event.target.value as Operation)}>{operations.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label><div className="question-total"><strong>{totalQuestions}</strong><span>questions selected<br />Maximum: 150</span></div><label>Time limit (minutes)<input name="minutes" type="number" min="1" max="180" defaultValue="2" /></label></div></section><section className="panel builder-section"><p className="eyebrow">2 · FACT FOCUS</p><div className="choice-grid focus-choice"><button type="button" className={focusMode === "selected" ? "choice selected" : "choice"} onClick={() => setFocusMode("selected")}><span>✎</span><strong>Choose fact groups</strong><small>Set the mix manually.</small></button><button type="button" className={focusMode === "student-level" ? "choice selected" : "choice"} onClick={() => { setFocusMode("student-level"); setSelected(students.map((entry) => entry.id)); }}><span>↗</span><strong>Each student at their level</strong><small>One assignment, personalized for everyone.</small></button></div>{focusMode === "student-level" ? <div className="weekly-options"><label>Questions per student<input type="number" min="1" max="150" value={weeklyQuestions} onChange={(event) => setWeeklyQuestions(Number(event.target.value))} /></label><label className="check-label"><input type="checkbox" checked={includeLower} onChange={(event) => setIncludeLower(event.target.checked)} /> Include facts below each student&apos;s current level</label>{includeLower && <label className="below-level-count">How many below-level questions?<input type="number" min="1" max={Math.max(1, weeklyQuestions)} value={belowLevelQuestions} onChange={(event) => setBelowLevelQuestions(Number(event.target.value))} /></label>}<p>For example, a student at level 5 receives level 5 facts{includeLower ? " plus levels 0–4" : ""}.</p></div> : <><h3>Choose one or more fact groups</h3><p className="helper">Select each group, then set exactly how many questions it contributes to this quiz.</p><div className="fact-mix">{Array.from({ length: info.range[1] - info.range[0] + 1 }, (_, index) => info.range[0] + index).map((number) => { const selectedGroup = groups.find((item) => item.group === number); return <div className={selectedGroup ? "fact-group selected" : "fact-group"} key={number} role="button" tabIndex={0} onClick={() => toggleGroup(number)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleGroup(number); } }}><span className="fact-group-number">{number}</span>{selectedGroup && <label onClick={(event) => event.stopPropagation()}><span>questions</span><input type="number" min="1" max="150" value={selectedGroup.questions} onChange={(event) => changeQuestions(number, Number(event.target.value))} /></label>}</div>; })}</div>{totalQuestions > 150 && <p className="form-error">Choose 150 questions or fewer before creating this quiz.</p>}</>}</section><section className="panel builder-section"><p className="eyebrow">3 · QUIZ TYPE</p><div className="choice-grid"><button type="button" disabled={!canLevel} className={type === "leveling" ? "choice selected" : "choice"} onClick={() => setType("leveling")}><span>↑</span><strong>Leveling quiz</strong><small>{canLevel ? "Passing can unlock the next fact group." : "Enable this operation’s level badge in Settings to use leveling quizzes."}</small></button><button type="button" className={type === "practice" ? "choice selected" : "choice"} onClick={() => setType("practice")}><span>✎</span><strong>Practice quiz</strong><small>A quick check-in with no level change.</small></button></div><div className="form-grid messages"><label>Pass at (%)<input name="threshold" type="number" min="1" max="100" defaultValue="80" /></label><label className="check-label"><input name="showScore" type="checkbox" defaultChecked /> Show score when finished</label><label>Pass message<input name="passMessage" defaultValue="Great work! You passed this quiz." /></label><label>Try-again message<input name="failMessage" defaultValue="Keep practicing. You are getting stronger every day!" /></label>{type === "leveling" && <label>Level-up message<input name="levelMessage" defaultValue="Amazing! You leveled up your multiplication facts!" /></label>}</div></section><section className="panel builder-section"><div className="assign-heading"><p className="eyebrow">4 · ASSIGN TO</p><div><button type="button" onClick={() => setSelected(students.map((entry) => entry.id))}>Select all</button><button type="button" onClick={() => setSelected([])}>Deselect all</button></div></div><div className="assign-list">{students.map((entry) => <label key={entry.id}><input type="checkbox" checked={selected.includes(entry.id)} onChange={() => setSelected((current) => current.includes(entry.id) ? current.filter((id) => id !== entry.id) : [...current, entry.id])} /><span className="avatar small-avatar">{entry.name[0]}</span>{entry.name}<small>Level {entry.levels[operation]}</small></label>)}</div></section><div className="builder-actions"><button className="secondary-btn" type="button" disabled={!groups.length || totalQuestions > 150} onClick={() => setPreview(makeProblems(operation, groups))}>Preview quiz</button><button className="secondary-btn" name="action" value="draft" disabled={!groups.length || totalQuestions > 150} type="submit">Save as draft</button><button className="primary-btn save-quiz" name="action" value="assign" disabled={!groups.length || totalQuestions > 150 || !selected.length} type="submit">Create and assign quiz <span>→</span></button></div></form>{preview && <QuizPreview operation={operation} problems={preview} close={() => setPreview(null)} refresh={() => setPreview(makeProblems(operation, groups))} />}</>;
}

function QuizPreview({ operation, problems, close, refresh }: { operation: Operation; problems: Problem[]; close: () => void; refresh: () => void }) {
  return <div className="preview-backdrop" role="dialog" aria-modal="true" aria-label="Quiz preview"><section className="preview-sheet"><div className="preview-heading"><div><p className="eyebrow">STUDENT VIEW</p><h2>{operationInfo(operation).label} quiz preview</h2><p>{problems.length} questions</p></div><button className="preview-close" onClick={close} aria-label="Close preview">×</button></div><div className="preview-problems">{problems.map((problem, index) => <div className="preview-problem" key={`${problem.top}-${problem.symbol}-${problem.bottom}-${index}`}><span>{index + 1}</span><div className="math-stack"><strong>{problem.top}</strong><strong>{problem.symbol} {problem.bottom}</strong><i /></div><div className="answer-box" /></div>)}</div><div className="preview-actions"><button className="secondary-btn" onClick={refresh}>Shuffle questions</button><button className="primary-btn compact" onClick={close}>Back to editing</button></div></section></div>;
}

function QuizDashboard({ classRoom, students, quizzes, results, initialQuizId, clearInitialQuiz, openStudent }: { classRoom: ClassRoom; students: Student[]; quizzes: Quiz[]; results: Result[]; initialQuizId: string | null; clearInitialQuiz: () => void; openStudent: (studentId: string) => void }) {
  const [quizId, setQuizId] = useState<string | null>(initialQuizId);
  const navigateQuiz = useHistoryState("quizDetail", quizId, setQuizId);
  useEffect(() => { if (initialQuizId) { setQuizId(initialQuizId); clearInitialQuiz(); } }, [initialQuizId, clearInitialQuiz]);
  const assigned = quizzes.filter((quiz) => quiz.status === "assigned");
  const quiz = assigned.find((entry) => entry.id === quizId);
  if (quiz) {
    const quizResults = results.filter((result) => result.quizId === quiz.id);
    const completed = quiz.assignedTo.filter((studentId) => quizResults.some((result) => result.studentId === studentId)).length;
    const average = quizResults.length ? Math.round(quizResults.reduce((sum, result) => sum + result.correct / result.total * 100, 0) / quizResults.length) : 0;
    return <div className="content-stack"><button className="back-link" onClick={() => navigateQuiz(null)}>← All assigned quizzes</button><section className="quiz-detail-hero"><div><p className="eyebrow">{operationInfo(quiz.operation).label.toUpperCase()} · {quiz.type.toUpperCase()}</p><h2>{quiz.title}</h2><p>{classRoom.name}</p></div><span className={`op-icon large ${operationInfo(quiz.operation).color}`}>{operationInfo(quiz.operation).symbol}</span></section><section className="quiz-metadata"><div><small>Date assigned</small><strong>{quiz.assignedAt ? fullDateLabel(quiz.assignedAt) : "Not recorded"}</strong></div><div><small>Students assigned</small><strong>{quiz.assignedTo.length} / {students.length}</strong></div><div><small>Completed</small><strong>{completed} / {quiz.assignedTo.length}</strong></div><div><small>Quiz length</small><strong>{quiz.problems} questions</strong></div><div><small>Time limit</small><strong>{quiz.minutes + (quiz.minutes === 1 ? " minute" : " minutes")}</strong></div><div><small>Class average</small><strong>{quizResults.length > 0 ? average + "%" : "No scores yet"}</strong></div></section><section className="panel quiz-roster"><div className="panel-heading"><div><p className="eyebrow">STUDENT PERFORMANCE</p><h3>Scores and completion</h3></div></div>{quiz.assignedTo.map((studentId) => { const learner = students.find((entry) => entry.id === studentId); const result = quizResults.find((entry) => entry.studentId === studentId); const percent = result ? Math.round(result.correct / result.total * 100) : null; return <button className="quiz-student-row quiz-student-button" onClick={() => learner && openStudent(learner.id)} disabled={!learner} key={studentId}><span className="avatar small-avatar">{learner?.name[0]}</span><div><strong>{learner?.name || "Student removed"}</strong><small>{learner ? operationInfo(quiz.operation).label + " level " + levelLabel(classRoom, quiz.operation, learner.levels[quiz.operation]) : "Level unavailable"} · {result ? "Completed " + dateLabel(result.completedAt) : "Not completed"}</small></div><b>{result ? `${result.correct}/${result.total}` : "—"}</b><span>{result ? String(percent) + "%" : "—"}</span><span className={result ? percent! >= quiz.threshold ? "status-pass" : "status-try" : "status-pending"}>{result ? percent! >= quiz.threshold ? quiz.type === "leveling" ? "Leveled Up!" : "Passed" : "Failed" : "Waiting"}</span></button>; })}</section></div>;
  }
  return <div className="content-stack"><section className="class-bar"><div><p className="eyebrow">{classRoom.name.toUpperCase()}</p><h2>Assigned quizzes <span>{assigned.length} total</span></h2></div></section>{assigned.length === 0 ? <section className="panel empty-state"><span>▤</span><h3>No quizzes assigned yet</h3><p>Assigned quizzes for this class will appear here.</p></section> : <section className="quiz-dashboard-grid">{assigned.slice().reverse().map((entry) => { const quizResults = results.filter((result) => result.quizId === entry.id); const completed = entry.assignedTo.filter((studentId) => quizResults.some((result) => result.studentId === studentId)).length; return <button className="quiz-dashboard-card" onClick={() => navigateQuiz(entry.id)} key={entry.id}><span className={`op-icon ${operationInfo(entry.operation).color}`}>{operationInfo(entry.operation).symbol}</span><div><p className="eyebrow">{entry.type} quiz</p><h3>{entry.title}</h3><small>Assigned {entry.assignedAt ? dateLabel(entry.assignedAt) : "recently"}</small></div><div className="completion-ring"><strong>{completed}/{entry.assignedTo.length}</strong><small>complete</small></div><span className="card-arrow">→</span></button>; })}</section>}</div>;
}

function ResultsPanel({ students, quizzes, results }: { students: Student[]; quizzes: Quiz[]; results: Result[] }) {
  const [period, setPeriod] = useState("all"); const [start, setStart] = useState(""); const [end, setEnd] = useState(""); const [selectedOperations, setSelectedOperations] = useState<Operation[]>([]); const [type, setType] = useState("all");
  const now = new Date();
  const cutoff = period === "week" ? 7 : period === "two-weeks" ? 14 : period === "month" ? 30 : null;
  const inRange = (date: string) => { const value = new Date(date); if (period === "custom") return (!start || value >= new Date(`${start}T00:00:00`)) && (!end || value <= new Date(`${end}T23:59:59`)); return cutoff === null || value >= new Date(now.getTime() - cutoff * 86400000); };
  const matchingQuizzes = quizzes.filter((quiz) => quiz.status === "assigned" && (quiz.assignedAt ? inRange(quiz.assignedAt) : period === "all") && (!selectedOperations.length || selectedOperations.includes(quiz.operation)) && (type === "all" || quiz.type === type));
  const matchingIds = new Set(matchingQuizzes.map((quiz) => quiz.id));
  const filtered = results.filter((result) => matchingIds.has(result.quizId) && inRange(result.completedAt));
  const leveledStudents = new Set(filtered.filter((result) => result.leveledUp).map((result) => result.studentId)).size;
  const average = filtered.length ? Math.round(filtered.reduce((total, result) => total + result.correct / result.total * 100, 0) / filtered.length) : null;
  return <div className="results-dashboard"><section className="results-filter-panel"><div><p className="eyebrow">FILTER ALL RESULTS</p><h2>Choose what to include</h2></div><div className="macro-filters"><label>Date range<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="week">Last week</option><option value="two-weeks">Last 2 weeks</option><option value="month">Last 30 days</option><option value="all">All time</option><option value="custom">Custom range</option></select></label><fieldset className="operation-multiselect"><legend>Arithmetic operations</legend><label><input type="checkbox" checked={!selectedOperations.length} onChange={() => setSelectedOperations([])} /> All</label>{operations.map((item) => <label key={item.value}><input type="checkbox" checked={selectedOperations.includes(item.value)} onChange={() => setSelectedOperations((current) => current.includes(item.value) ? current.filter((operation) => operation !== item.value) : [...current, item.value])} />{item.label}</label>)}</fieldset><label>Quiz type<select value={type} onChange={(event) => setType(event.target.value)}><option value="all">All quiz types</option><option value="leveling">Leveling quizzes</option><option value="practice">Practice quizzes</option></select></label></div>{period === "custom" && <div className="custom-dates"><label>From<input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>Through<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label></div>}</section><section className="results-kpis"><div><span>▤</span><small>Quizzes created</small><strong>{matchingQuizzes.length}</strong></div><div><span>↑</span><small>Students who leveled up</small><strong>{leveledStudents}</strong></div><div><span>%</span><small>Average score</small><strong>{average === null ? "—" : `${average}%`}</strong></div></section><section className="panel results-summary"><div className="panel-heading"><div><p className="eyebrow">RESULTS SUMMARY</p><h3>{filtered.length} completed attempt{filtered.length === 1 ? "" : "s"}</h3></div></div>{filtered.length === 0 ? <div className="empty-state"><span>◒</span><h3>No matching results</h3><p>Try changing the date, operation, or quiz type filters.</p></div> : <div className="results-table"><div className="results-table-head"><span>Student</span><span>Quiz</span><span>Date</span><span>Score</span><span>Outcome</span></div>{filtered.slice().reverse().map((result) => { const learner = students.find((entry) => entry.id === result.studentId); const quiz = quizzes.find((entry) => entry.id === result.quizId)!; const percent = Math.round(result.correct / result.total * 100); return <div className="results-table-row" key={`${result.quizId}-${result.studentId}`}><span className="student-name"><span className="avatar small-avatar">{learner?.name[0]}</span><strong>{learner?.name}</strong></span><span><strong>{quiz.title}</strong><small>{operationInfo(quiz.operation).label} · {quiz.type}</small></span><span>{dateLabel(result.completedAt)}</span><span><b>{percent}%</b><small>{result.correct}/{result.total}</small></span><span>{result.leveledUp ? <span className="earned">Level up!</span> : <span className={percent >= quiz.threshold ? "status-pass" : "status-try"}>{percent >= quiz.threshold ? "Passed" : "Keep practicing"}</span>}</span></div>; })}</div>}</section></div>;
}

function StudentApp({ student, operationsShown, quizzes, results, view, setView, startQuiz, logout }: { student: Student; operationsShown: Operation[]; quizzes: Quiz[]; results: Result[]; view: string; setView: (view: "home" | "history") => void; startQuiz: (quiz: Quiz) => void; logout: () => void }) {
  const pending = quizzes.filter((quiz) => quiz.status === "assigned" && quiz.assignedTo.includes(student.id) && !results.some((result) => result.quizId === quiz.id && result.studentId === student.id));
  const titles = { home: `Hi, ${student.name.split(" ")[0]}!`, history: "Your progress" };
  return <Shell label={student.name} role="student" title={titles[view as keyof typeof titles]} onLogout={logout} active={view} setActive={setView as never} tabs={[{ id: "home", label: "My quizzes", icon: "⌂" }, { id: "history", label: "My progress", icon: "◒" }]}>
    {view === "home" ? <div className="content-stack"><section className="student-hero"><div><p className="eyebrow">READY WHEN YOU ARE</p><h2>You&apos;ve got this!</h2><p>Take your time, trust your thinking, and have fun with numbers.</p></div><span>✦</span></section><section><div className="section-title"><div><p className="eyebrow">UP NEXT</p><h2>Your quizzes</h2></div><span className="count-badge">{pending.length} waiting</span></div>{pending.length === 0 ? <div className="empty-state panel"><span>★</span><h3>All caught up!</h3><p>There are no quizzes waiting for you right now.</p></div> : <div className="quiz-cards">{pending.map((quiz) => <article className="student-quiz-card" key={quiz.id}><span className={`op-icon large ${operationInfo(quiz.operation).color}`}>{operationInfo(quiz.operation).symbol}</span><div><p className="eyebrow">{quiz.type === "leveling" ? "LEVEL-UP CHALLENGE" : "PRACTICE QUIZ"}</p><h3>{quiz.title}</h3><p>{quiz.problems} questions · about {quiz.minutes} minute{quiz.minutes === 1 ? "" : "s"}</p></div><button className="primary-btn compact" onClick={() => startQuiz(quiz)}>Start <span>→</span></button></article>)}</div>}</section><LevelCards levels={student.levels} operationsShown={operationsShown} /></div> : <StudentHistory student={student} operationsShown={operationsShown} quizzes={quizzes} results={results} />}
  </Shell>;
}

function LevelCards({ levels, operationsShown }: { levels: Record<Operation, number>; operationsShown: Operation[] }) { return <section><div className="section-title"><div><p className="eyebrow">YOUR TOOLBOX</p><h2>Fact levels</h2></div></div><div className="level-card-grid">{operations.map((item) => <div className="level-card" key={item.value}><span className={`op-icon ${item.color}`}>{item.symbol}</span><div><small>{item.label}</small><strong>Level {levels[item.value]}</strong></div></div>)}</div></section>; }

function StudentHistory({ student, operationsShown, quizzes, results }: { student: Student; operationsShown: Operation[]; quizzes: Quiz[]; results: Result[] }) { const completed = results.filter((result) => result.studentId === student.id); return <div className="content-stack"><LevelCards levels={student.levels} operationsShown={operationsShown} /><section className="panel results-panel"><p className="eyebrow">YOUR HISTORY</p><h3>Completed quizzes</h3>{completed.length === 0 ? <div className="empty-state"><span>✦</span><p>Your finished quizzes will show up here.</p></div> : completed.slice().reverse().map((result) => { const quiz = quizzes.find((item) => item.id === result.quizId); return <div className="result-row" key={result.quizId}><span className={`op-icon ${operationInfo(quiz!.operation).color}`}>{operationInfo(quiz!.operation).symbol}</span><div><strong>{quiz?.title}</strong><small>{dateLabel(result.completedAt)}</small></div><b>{result.correct}/{result.total}</b>{result.leveledUp && <span className="earned">Level up!</span>}</div>; })}</section></div>; }

function QuizScreen({ quiz, problems, answers, setAnswers, secondsLeft, submit, outcome, answerWarning, clearWarning, done, logout }: { quiz: Quiz; problems: Problem[]; answers: string[]; setAnswers: React.Dispatch<React.SetStateAction<string[]>>; secondsLeft: number; submit: () => void; outcome: Result | null; answerWarning: string; clearWarning: () => void; done: () => void; logout: () => void }) {
  if (outcome) { const passed = (outcome.correct / outcome.total) * 100 >= quiz.threshold; const nextGroup = Math.min(operationInfo(quiz.operation).range[1], quiz.group + 1); return <main className="quiz-page"><header className="quiz-header"><div className="brand"><span className="brand-mark">+</span> Fact Friends</div><button className="header-sign-out" onClick={logout}>↩ Sign out</button></header><section className="outcome-card"><span className="outcome-star">{outcome.leveledUp ? "★" : passed ? "✦" : "♥"}</span><p className="eyebrow">QUIZ COMPLETE</p><h1>{outcome.leveledUp ? quiz.levelMessage : passed ? quiz.passMessage : quiz.failMessage}</h1>{outcome.leveledUp && <p className="next-level-message">Your next level will be {nextGroup}.</p>}{quiz.showScore ? <div className="score-circle"><strong>{outcome.correct}<small>/{outcome.total}</small></strong><span>correct</span></div> : <p>Your teacher has received your work.</p>}<button className="primary-btn" onClick={done}>Back to my quizzes <span>→</span></button></section></main>; }
  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0"); const seconds = String(secondsLeft % 60).padStart(2, "0");
  return <main className="quiz-page"><header className="quiz-header"><div className="brand"><span className="brand-mark">+</span> Fact Friends</div><div className="quiz-meta"><span>{quiz.title}</span><b>◷ {minutes}:{seconds}</b><button className="header-sign-out" onClick={logout}>↩ Sign out</button></div></header><section className="quiz-work"><div className="quiz-intro"><p className="eyebrow">{quiz.type === "leveling" ? "LEVEL-UP CHALLENGE" : "PRACTICE TIME"}</p><h1>Show what you know!</h1><p>Answer each question, then send your work when you&apos;re ready.</p></div>{answerWarning && <div className="answer-warning" role="alert"><strong>Almost there!</strong><span>{answerWarning}</span></div>}<div className="problem-grid">{problems.map((problem, index) => <label className={`problem vertical-problem ${answerWarning && !answers[index].trim() ? "unanswered" : ""}`} key={`${problem.top}-${problem.symbol}-${problem.bottom}-${index}`}><span>{index + 1}</span><div className="math-stack"><strong>{problem.top}</strong><strong>{problem.symbol} {problem.bottom}</strong><i /></div><input data-quiz-answer aria-label={`Answer for   `} inputMode="numeric" value={answers[index] || ""} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("[data-quiz-answer]")); inputs[index + 1]?.focus(); } }} onChange={(event) => { clearWarning(); setAnswers((current) => current.map((value, answerIndex) => answerIndex === index ? event.target.value : value)); }} /></label>)}</div><button className="primary-btn submit-btn" onClick={submit}>Send my answers <span>→</span></button></section></main>;
}
