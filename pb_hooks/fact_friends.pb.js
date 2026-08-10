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

// Look up a class by its code. An optional studentId says who is already signed
// in on this device, so a shared class link can tell "this is my class, take me
// to my work" apart from "someone new is joining on this device".
routerAdd("POST", "/api/fact-friends/class-code", (e) => {
  const data = new DynamicModel({ classCode: "", studentId: "" });
  e.bindBody(data);

  const classCode = data.classCode.trim();
  if (!/^\d{4,6}$/.test(classCode)) {
    throw new BadRequestError("Enter a 4 to 6 digit class code.");
  }

  let classRoom;
  try {
    classRoom = e.app.findFirstRecordByData("classes", "classCode", classCode);
    if (classRoom.getBool("archived")) {
      throw new Error("Archived class");
    }
  } catch (_) {
    throw new BadRequestError("That class code was not found. Check with your teacher and try again.");
  }

  let studentInClass = false;
  const studentId = (data.studentId || "").trim();
  if (studentId) {
    try {
      studentInClass = e.app.findRecordById("students", studentId).getString("class") === classRoom.id;
    } catch (_) {}
  }

  return e.json(200, { classId: classRoom.id, className: classRoom.getString("name"), studentInClass: studentInClass });
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

  // Read a quiz's title and shape out of its JSON field. A quiz has no operation
  // of its own, so it is identified by the icon and colour the teacher picked.
  function quizDetails(quizId) {
    try {
      const quiz = e.app.findRecordById("quizzes", quizId);
      const details = JSON.parse(quiz.getString("data") || "{}");
      return {
        quizId: quiz.id,
        title: details.title || "Quiz",
        icon: details.icon || "",
        shade: details.shade || "",
        questionCount: (details.problems || []).length,
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
      icon: quiz.icon,
      shade: quiz.shade,
      questionCount: quiz.questionCount,
      timeLimitMinutes: quiz.timeLimitMinutes,
      released: enrollment.getBool("released"),
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
      icon: quiz ? quiz.icon : "",
      shade: quiz ? quiz.shade : "",
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
    extraTimeMinutes: require(`${__hooks}/accommodations.js`)(student).extraTimeMinutes,
    forYou: forYou,
    history: history,
  });
});

// The quiz a student is about to sit, with the settings the screen needs.
routerAdd("POST", "/api/fact-friends/quiz-step", (e) => {
  const data = new DynamicModel({ studentId: "", stepId: "" });
  e.bindBody(data);

  const studentStep = require(`${__hooks}/student_step.js`);
  const found = studentStep(e.app, (data.studentId || "").trim(), (data.stepId || "").trim());
  if (!found) throw new NotFoundError("This quiz is not waiting for you right now.");

  let quiz, details;
  try {
    quiz = e.app.findRecordById("quizzes", found.step.getString("quiz"));
    details = JSON.parse(quiz.getString("data") || "{}");
  } catch (_) {
    throw new NotFoundError("We could not open this quiz.");
  }

  // The teacher decides whether a quiz can be handed in with blanks.
  let allowIncompleteAnswers = true;
  try {
    const classRoom = e.app.findRecordById("classes", found.progression.getString("class"));
    allowIncompleteAnswers = e.app.findRecordById("teachers", classRoom.getString("teacher")).getBool("allowIncompleteAnswers");
  } catch (_) {}

  const accommodations = require(`${__hooks}/accommodations.js`)(found.student);

  return e.json(200, {
    studentName: found.student.getString("name"),
    progressionName: found.progression.getString("name"),
    extraTimeMinutes: accommodations.extraTimeMinutes,
    position: found.position,
    totalSteps: found.steps.length,
    passPercentage: found.progression.getInt("passPercentage"),
    allowIncompleteAnswers: allowIncompleteAnswers,
    // The path decides whether its steps arrive one question at a time. Paths
    // built before this setting existed show the whole sheet.
    oneAtATime: found.progression.getBool("oneAtATime"),
    quiz: {
      title: details.title || "Quiz",
      // The stored questions, in the order the teacher arranged them. Marking
      // reads this same list back, so it is the one source of truth.
      problems: details.problems || [],
      timeLimitMinutes: details.timeLimitMinutes || 0,
      showScore: details.showScore !== false,
      passMessage: details.passMessage || "Great work! You finished this quiz.",
    },
  });
});

// Save a finished quiz. Reaching the pass mark moves the student to the next
// step; falling short is recorded but changes nothing, so they stay put.
routerAdd("POST", "/api/fact-friends/record-attempt", (e) => {
  const data = new DynamicModel({ studentId: "", stepId: "", correct: 0, total: 0, secondsRemaining: 0, responses: [] });
  e.bindBody(data);

  const studentStep = require(`${__hooks}/student_step.js`);
  const found = studentStep(e.app, (data.studentId || "").trim(), (data.stepId || "").trim());
  if (!found) throw new NotFoundError("This quiz is not waiting for you right now.");

  const correct = Math.max(0, Math.round(data.correct));
  const total = Math.max(0, Math.round(data.total));
  const percentage = total ? Math.round((correct / total) * 100) : 0;
  const passed = total > 0 && percentage >= found.progression.getInt("passPercentage");

  // Every release allows exactly one attempt. Passing moves them along the
  // ladder; falling short leaves them on this step for their next release.
  found.enrollment.set("released", false);
  let leveledUp = false;
  let finishedProgression = false;
  let nextQuizName = "";
  if (passed) {
    const nextStep = found.steps[found.position];
    if (nextStep) {
      found.enrollment.set("currentStep", nextStep.id);
      leveledUp = true;
      try {
        const nextQuiz = e.app.findRecordById("quizzes", nextStep.getString("quiz"));
        nextQuizName = JSON.parse(nextQuiz.getString("data") || "{}").title || "Next quiz";
      } catch (_) {
        nextQuizName = "Next quiz";
      }
    } else {
      found.enrollment.set("status", "completed");
      finishedProgression = true;
    }
  }
  e.app.save(found.enrollment);

  const attempt = new Record(e.app.findCollectionByNameOrId("quiz_attempts"));
  attempt.set("quiz", found.step.getString("quiz"));
  attempt.set("student", found.student.id);
  attempt.set("correct", correct);
  attempt.set("total", total);
  attempt.set("passed", passed);
  attempt.set("leveledUp", leveledUp);
  attempt.set("completedAt", new DateTime());
  attempt.set("secondsRemaining", Math.max(0, Math.round(data.secondsRemaining)));
  attempt.set("responses", data.responses || []);
  attempt.set("progressionEnrollment", found.enrollment.id);
  attempt.set("progressionStep", found.step.id);
  e.app.save(attempt);

  return e.json(200, { correct: correct, total: total, percentage: percentage, passed: passed, leveledUp: leveledUp, finishedProgression: finishedProgression, nextQuizName: nextQuizName });
});
