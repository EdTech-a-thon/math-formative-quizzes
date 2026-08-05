/// <reference path="../pb_data/types.d.ts" />

// Operations and per-operation student levels are no longer stored on the class.
// A class is now just a roster + join code; all math content and student
// progress lives in progressions (auto-seeded per class, see pb_hooks).
migrate((app) => {
  const classes = app.findCollectionByNameOrId("classes");
  classes.fields.removeByName("operations");
  app.save(classes);

  const students = app.findCollectionByNameOrId("students");
  students.fields.removeByName("levels");
  app.save(students);

  const progressions = app.findCollectionByNameOrId("progressions");
  progressions.fields.add(new Field({
    name: "operation",
    type: "select",
    maxSelect: 1,
    values: ["multiplication", "division", "addition", "subtraction"],
  }));
  app.save(progressions);
}, (app) => {
  const classes = app.findCollectionByNameOrId("classes");
  classes.fields.add(new Field({ name: "operations", type: "json" }));
  app.save(classes);

  const students = app.findCollectionByNameOrId("students");
  students.fields.add(new Field({ name: "levels", type: "json" }));
  app.save(students);

  const progressions = app.findCollectionByNameOrId("progressions");
  progressions.fields.removeByName("operation");
  app.save(progressions);
});
