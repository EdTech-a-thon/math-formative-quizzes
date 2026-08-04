// When a class is created, seed the default learning paths: one progression per
// operation, each a ladder of single-fact-family quizzes. Teachers assign
// students to these; everything about a student's progress lives in the paths.
onRecordAfterCreateSuccess((e) => {
  const ladders = [
    { op: "multiplication", label: "Multiplication", verb: "Multiply by", from: 0, to: 12 },
    { op: "division", label: "Division", verb: "Divide by", from: 1, to: 12 },
    { op: "addition", label: "Addition", verb: "Add", from: 0, to: 12 },
    { op: "subtraction", label: "Subtraction", verb: "Subtract", from: 0, to: 9 },
  ];
  try {
    const app = e.app;
    const classId = e.record.id;
    const progressions = app.findCollectionByNameOrId("progressions");
    const quizzes = app.findCollectionByNameOrId("quizzes");
    const steps = app.findCollectionByNameOrId("progression_steps");

    for (const ladder of ladders) {
      const progression = new Record(progressions);
      progression.set("class", classId);
      progression.set("name", ladder.label);
      progression.set("description", "Step through " + ladder.label.toLowerCase() + " facts, one fact family at a time.");
      progression.set("passPercentage", 80);
      progression.set("status", "active");
      progression.set("operation", ladder.op);
      app.save(progression);

      let position = 1;
      for (let group = ladder.from; group <= ladder.to; group++) {
        const quiz = new Record(quizzes);
        quiz.set("class", classId);
        quiz.set("data", {
          title: ladder.verb + " " + group,
          operation: ladder.op,
          factGroups: [{ group: group, from: 1, to: 12 }],
          questionCount: 12,
          timeLimitMinutes: 2,
          showScore: true,
          passMessage: "Great work! You finished this quiz.",
        });
        app.save(quiz);

        const step = new Record(steps);
        step.set("progression", progression.id);
        step.set("quiz", quiz.id);
        step.set("position", position);
        app.save(step);
        position++;
      }
    }
  } catch (err) {
    $app.logger().error("Failed to seed default progressions", "class", e.record.id, "error", String(err));
  }
  e.next();
}, "classes");

// A student joins a class by code + name. Open classes create the student on the
// fly; roster ("closed") classes only admit names already on the roster. Runs
// with app-level access, so it bypasses the teacher-only student create rule.
routerAdd("POST", "/api/fact-friends/join", (e) => {
  const data = new DynamicModel({ classCode: "", name: "" });
  e.bindBody(data);

  const classCode = (data.classCode || "").trim();
  const name = (data.name || "").trim();
  if (!/^\d{4,6}$/.test(classCode)) throw new BadRequestError("Enter the class code your teacher shared.");
  if (!name) throw new BadRequestError("Enter your name to continue.");
  const loginName = name.toLowerCase().replace(/[^a-z]/g, "");
  if (!loginName) throw new BadRequestError("Enter your name using letters.");

  let classRoom;
  try {
    classRoom = e.app.findFirstRecordByData("classes", "classCode", classCode);
  } catch (_) {
    throw new BadRequestError("That class code was not found. Check with your teacher and try again.");
  }
  if (classRoom.getBool("archived")) throw new BadRequestError("That class is no longer active.");

  let signupMode = "open";
  try {
    // levelFormats is a JSON field; getString returns its serialized text.
    const formats = JSON.parse(classRoom.getString("levelFormats") || "{}");
    if (formats && formats.signupMode) signupMode = formats.signupMode;
  } catch (_) {}

  let student = null;
  try {
    student = e.app.findFirstRecordByFilter("students", "class = {:c} && loginName = {:l}", { c: classRoom.id, l: loginName });
  } catch (_) {}

  if (!student) {
    if (signupMode === "closed") {
      throw new BadRequestError("We could not find your name on the class roster. Ask your teacher to add you.");
    }
    const students = e.app.findCollectionByNameOrId("students");
    student = new Record(students);
    student.set("class", classRoom.id);
    student.set("name", name);
    student.set("loginName", loginName);
    e.app.save(student);
  }

  return e.json(200, { studentId: student.id, studentName: student.getString("name"), className: classRoom.getString("name") });
});

routerAdd("POST", "/api/fact-friends/class-code", (e) => {
  const data = new DynamicModel({ classCode: "" });
  e.bindBody(data);

  const classCode = data.classCode.trim();
  if (!/^\d{4,6}$/.test(classCode)) {
    throw new BadRequestError("Enter a 4 to 6 digit class code.");
  }

  try {
    const classRoom = e.app.findFirstRecordByData("classes", "classCode", classCode);
    if (classRoom.getBool("archived")) {
      throw new Error("Archived class");
    }
    return e.json(200, { classId: classRoom.id, className: classRoom.getString("name") });
  } catch (_) {
    throw new BadRequestError("That class code was not found. Check with your teacher and try again.");
  }
});

// Everything a student's home screen shows: the quiz waiting for them on each
// progression their teacher assigned, plus the quizzes they have finished.
// Runs with app-level access because students do not have their own accounts.
routerAdd("POST", "/api/fact-friends/student-home", (e) => {
  const data = new DynamicModel({ studentId: "" });
  e.bindBody(data);

  const studentId = (data.studentId || "").trim();
  if (!studentId) throw new BadRequestError("Sign in to see your practice.");

  let student;
  try {
    student = e.app.findRecordById("students", studentId);
  } catch (_) {
    throw new NotFoundError("We could not find you in this class.");
  }

  let className = "";
  try {
    className = e.app.findRecordById("classes", student.getString("class")).getString("name");
  } catch (_) {}

  // Read a quiz's title and shape out of its JSON field.
  function quizDetails(quizId) {
    try {
      const quiz = e.app.findRecordById("quizzes", quizId);
      const details = JSON.parse(quiz.getString("data") || "{}");
      return {
        quizId: quiz.id,
        title: details.title || "Quiz",
        operation: details.operation || "",
        questionCount: details.questionCount || 0,
        timeLimitMinutes: details.timeLimitMinutes || 0,
      };
    } catch (_) {
      return null;
    }
  }

  let enrollments = [];
  try {
    // These records carry no created date, so they are ordered by id.
    enrollments = e.app.findRecordsByFilter("progression_enrollments", "student = {:s}", "id", 100, 0, { s: student.id });
  } catch (_) {}

  const forYou = [];
  for (let item = 0; item < enrollments.length; item++) {
    const enrollment = enrollments[item];
    if (enrollment.getString("status") === "completed") continue;

    let progression, steps;
    try {
      progression = e.app.findRecordById("progressions", enrollment.getString("progression"));
      steps = e.app.findRecordsByFilter("progression_steps", "progression = {:p}", "position", 500, 0, { p: progression.id });
    } catch (_) {
      continue;
    }
    if (!steps.length) continue;

    // Fall back to the first step for an enrollment that never got one set.
    const currentStepId = enrollment.getString("currentStep") || steps[0].id;
    let position = 1;
    let step = steps[0];
    for (let index = 0; index < steps.length; index++) {
      if (steps[index].id === currentStepId) {
        position = index + 1;
        step = steps[index];
      }
    }

    const quiz = quizDetails(step.getString("quiz"));
    if (!quiz) continue;
    forYou.push({
      stepId: step.id,
      progressionName: progression.getString("name"),
      position: position,
      totalSteps: steps.length,
      quizId: quiz.quizId,
      title: quiz.title,
      operation: quiz.operation || progression.getString("operation"),
      questionCount: quiz.questionCount,
      timeLimitMinutes: quiz.timeLimitMinutes,
    });
  }

  let attempts = [];
  try {
    attempts = e.app.findRecordsByFilter("quiz_attempts", "student = {:s}", "-completedAt", 30, 0, { s: student.id });
  } catch (_) {}

  const history = [];
  for (let item = 0; item < attempts.length; item++) {
    const attempt = attempts[item];
    const quiz = quizDetails(attempt.getString("quiz"));
    history.push({
      id: attempt.id,
      title: quiz ? quiz.title : "Quiz",
      operation: quiz ? quiz.operation : "",
      correct: attempt.getInt("correct"),
      total: attempt.getInt("total"),
      passed: attempt.getBool("passed"),
      leveledUp: attempt.getBool("leveledUp"),
      completedAt: attempt.getDateTime("completedAt").string(),
    });
  }

  return e.json(200, {
    studentName: student.getString("name"),
    className: className,
    forYou: forYou,
    history: history,
  });
});
