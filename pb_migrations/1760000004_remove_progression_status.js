/// <reference path="../pb_data/types.d.ts" />

// A progression is no longer "draft"/"active"/"archived" — it either is or isn't
// assigned to a student (see progression_enrollments). The status flag on the
// progression itself no longer means anything, so drop it. (The active/completed
// status on progression_enrollments is a separate field and stays.)
migrate((app) => {
  const progressions = app.findCollectionByNameOrId("progressions");
  progressions.fields.removeByName("status");
  app.save(progressions);
}, (app) => {
  const progressions = app.findCollectionByNameOrId("progressions");
  progressions.fields.add(new Field({
    name: "status",
    type: "select",
    required: true,
    maxSelect: 1,
    values: ["draft", "active", "archived"],
  }));
  app.save(progressions);
});
