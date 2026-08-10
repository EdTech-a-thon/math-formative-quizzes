/// <reference path="../pb_data/types.d.ts" />

// A score of zero is a real result: a student can get every question wrong, and
// that hand-in has to be saved like any other. A "required" number field treats
// 0 as blank and refuses it, so these two are no longer required. Both are
// always written when an attempt is recorded.
migrate((app) => {
  const attempts = app.findCollectionByNameOrId("quiz_attempts");
  for (const name of ["correct", "total"]) attempts.fields.getByName(name).required = false;
  app.save(attempts);
}, (app) => {
  const attempts = app.findCollectionByNameOrId("quiz_attempts");
  for (const name of ["correct", "total"]) attempts.fields.getByName(name).required = true;
  app.save(attempts);
});
