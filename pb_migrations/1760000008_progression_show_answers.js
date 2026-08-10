/// <reference path="../pb_data/types.d.ts" />

// Whether students get their answers back after a quiz — the questions they got
// wrong, with the right answer to study. Like the one-at-a-time setting it
// belongs to the path, so a student is treated the same way at every step.
// Unset means answers stay between the student and their teacher.
migrate((app) => {
  const progressions = app.findCollectionByNameOrId("progressions");
  progressions.fields.add(new Field({ name: "showAnswers", type: "bool" }));
  app.save(progressions);
}, (app) => {
  const progressions = app.findCollectionByNameOrId("progressions");
  progressions.fields.removeByName("showAnswers");
  app.save(progressions);
});
