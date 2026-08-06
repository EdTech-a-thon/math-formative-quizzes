/// <reference path="../pb_data/types.d.ts" />

// Per-student accommodations, e.g. { "extraTimeMinutes": 5 }. Kept as one JSON
// field so further accommodations can be added without another migration.
migrate((app) => {
  const students = app.findCollectionByNameOrId("students");
  students.fields.add(new Field({ name: "accommodations", type: "json" }));
  app.save(students);
}, (app) => {
  const students = app.findCollectionByNameOrId("students");
  students.fields.removeByName("accommodations");
  app.save(students);
});
