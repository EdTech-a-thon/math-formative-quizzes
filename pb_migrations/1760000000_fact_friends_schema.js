migrate((app) => {
  const teachers = new Collection({
    type: "auth",
    name: "teachers",
    listRule: "id = @request.auth.id",
    viewRule: "id = @request.auth.id",
    createRule: "",
    updateRule: "id = @request.auth.id",
    deleteRule: "id = @request.auth.id",
    fields: [
      { name: "name", type: "text", required: true, max: 100 },
      { name: "allowIncompleteAnswers", type: "bool" },
      { name: "theme", type: "text", max: 20 },
    ],
  });
  app.save(teachers);

  const classes = new Collection({
    type: "base",
    name: "classes",
    listRule: "teacher = @request.auth.id",
    viewRule: "teacher = @request.auth.id",
    createRule: "@request.auth.id != '' && teacher = @request.auth.id",
    updateRule: "teacher = @request.auth.id",
    deleteRule: "teacher = @request.auth.id",
    fields: [
      { name: "teacher", type: "relation", required: true, collectionId: teachers.id, maxSelect: 1, cascadeDelete: true },
      { name: "name", type: "text", required: true, max: 120 },
      { name: "classCode", type: "text", required: true, min: 4, max: 6 },
      { name: "archived", type: "bool" },
      { name: "operations", type: "json", required: true },
      { name: "levelFormats", type: "json" },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_classes_class_code ON classes (classCode)"],
  });
  app.save(classes);

  const students = new Collection({
    type: "base",
    name: "students",
    listRule: "class.teacher = @request.auth.id",
    viewRule: "class.teacher = @request.auth.id",
    createRule: "class.teacher = @request.auth.id",
    updateRule: "class.teacher = @request.auth.id",
    deleteRule: "class.teacher = @request.auth.id",
    fields: [
      { name: "class", type: "relation", required: true, collectionId: classes.id, maxSelect: 1, cascadeDelete: true },
      { name: "name", type: "text", required: true, max: 120 },
      { name: "loginName", type: "text", required: true, max: 120 },
      { name: "profileIcon", type: "text", max: 20 },
      { name: "profileColor", type: "text", max: 20 },
      { name: "levels", type: "json", required: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_students_class_login_name ON students (class, loginName)"],
  });
  app.save(students);

  const quizzes = new Collection({
    type: "base",
    name: "quizzes",
    listRule: "class.teacher = @request.auth.id",
    viewRule: "class.teacher = @request.auth.id",
    createRule: "class.teacher = @request.auth.id",
    updateRule: "class.teacher = @request.auth.id",
    deleteRule: "class.teacher = @request.auth.id",
    fields: [
      { name: "class", type: "relation", required: true, collectionId: classes.id, maxSelect: 1, cascadeDelete: true },
      { name: "data", type: "json", required: true },
    ],
  });
  app.save(quizzes);

  const assignments = new Collection({
    type: "base",
    name: "quiz_assignments",
    listRule: "quiz.class.teacher = @request.auth.id",
    viewRule: "quiz.class.teacher = @request.auth.id",
    createRule: "quiz.class.teacher = @request.auth.id",
    updateRule: "quiz.class.teacher = @request.auth.id",
    deleteRule: "quiz.class.teacher = @request.auth.id",
    fields: [
      { name: "quiz", type: "relation", required: true, collectionId: quizzes.id, maxSelect: 1, cascadeDelete: true },
      { name: "student", type: "relation", required: true, collectionId: students.id, maxSelect: 1, cascadeDelete: true },
      { name: "status", type: "select", required: true, maxSelect: 1, values: ["assigned", "completed"] },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_quiz_assignments_quiz_student ON quiz_assignments (quiz, student)"],
  });
  app.save(assignments);

  const attempts = new Collection({
    type: "base",
    name: "quiz_attempts",
    listRule: "quiz.class.teacher = @request.auth.id",
    viewRule: "quiz.class.teacher = @request.auth.id",
    createRule: "quiz.class.teacher = @request.auth.id",
    updateRule: "quiz.class.teacher = @request.auth.id",
    deleteRule: "quiz.class.teacher = @request.auth.id",
    fields: [
      { name: "quiz", type: "relation", required: true, collectionId: quizzes.id, maxSelect: 1, cascadeDelete: true },
      { name: "student", type: "relation", required: true, collectionId: students.id, maxSelect: 1, cascadeDelete: true },
      { name: "correct", type: "number", required: true, min: 0 },
      { name: "total", type: "number", required: true, min: 0 },
      { name: "leveledUp", type: "bool" },
      { name: "completedAt", type: "date", required: true },
      { name: "secondsRemaining", type: "number", min: 0 },
      { name: "responses", type: "json", required: true },
    ],
    indexes: ["CREATE INDEX idx_quiz_attempts_student_completed ON quiz_attempts (student, completedAt)"],
  });
  app.save(attempts);

}, (app) => {
  for (const name of ["quiz_attempts", "quiz_assignments", "quizzes", "students", "classes", "teachers"]) {
    try {
      app.delete(app.findCollectionByNameOrId(name));
    } catch (_) {
      // The collection may already have been removed.
    }
  }
});
