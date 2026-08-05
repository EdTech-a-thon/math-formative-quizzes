migrate((app) => {
  const classes = app.findCollectionByNameOrId("classes");
  const quizzes = app.findCollectionByNameOrId("quizzes");
  const students = app.findCollectionByNameOrId("students");

  const progressions = new Collection({
    type: "base",
    name: "progressions",
    listRule: "class.teacher = @request.auth.id",
    viewRule: "class.teacher = @request.auth.id",
    createRule: "class.teacher = @request.auth.id",
    updateRule: "class.teacher = @request.auth.id",
    deleteRule: "class.teacher = @request.auth.id",
    fields: [
      { name: "class", type: "relation", required: true, collectionId: classes.id, maxSelect: 1, cascadeDelete: true },
      { name: "name", type: "text", required: true, max: 120 },
      { name: "description", type: "text", max: 500 },
      { name: "passPercentage", type: "number", required: true, min: 1, max: 100 },
      { name: "status", type: "select", required: true, maxSelect: 1, values: ["draft", "active", "archived"] },
    ],
  });
  app.save(progressions);

  const steps = new Collection({
    type: "base",
    name: "progression_steps",
    listRule: "progression.class.teacher = @request.auth.id",
    viewRule: "progression.class.teacher = @request.auth.id",
    createRule: "progression.class.teacher = @request.auth.id",
    updateRule: "progression.class.teacher = @request.auth.id",
    deleteRule: "progression.class.teacher = @request.auth.id",
    fields: [
      { name: "progression", type: "relation", required: true, collectionId: progressions.id, maxSelect: 1, cascadeDelete: true },
      { name: "quiz", type: "relation", required: true, collectionId: quizzes.id, maxSelect: 1, cascadeDelete: true },
      { name: "position", type: "number", required: true, min: 1 },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_progression_steps_position ON progression_steps (progression, position)"],
  });
  app.save(steps);

  const enrollments = new Collection({
    type: "base",
    name: "progression_enrollments",
    listRule: "progression.class.teacher = @request.auth.id",
    viewRule: "progression.class.teacher = @request.auth.id",
    createRule: "progression.class.teacher = @request.auth.id",
    updateRule: "progression.class.teacher = @request.auth.id",
    deleteRule: "progression.class.teacher = @request.auth.id",
    fields: [
      { name: "progression", type: "relation", required: true, collectionId: progressions.id, maxSelect: 1, cascadeDelete: true },
      { name: "student", type: "relation", required: true, collectionId: students.id, maxSelect: 1, cascadeDelete: true },
      { name: "currentStep", type: "relation", collectionId: steps.id, maxSelect: 1 },
      { name: "status", type: "select", required: true, maxSelect: 1, values: ["active", "completed"] },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_progression_enrollment ON progression_enrollments (progression, student)"],
  });
  app.save(enrollments);

  const attempts = app.findCollectionByNameOrId("quiz_attempts");
  attempts.fields.add(new Field({ name: "progressionEnrollment", type: "relation", collectionId: enrollments.id, maxSelect: 1, cascadeDelete: true }));
  attempts.fields.add(new Field({ name: "progressionStep", type: "relation", collectionId: steps.id, maxSelect: 1, cascadeDelete: true }));
  attempts.fields.add(new Field({ name: "passed", type: "bool" }));
  app.save(attempts);
}, (app) => {
  for (const name of ["progression_enrollments", "progression_steps", "progressions"]) app.delete(app.findCollectionByNameOrId(name));
});
