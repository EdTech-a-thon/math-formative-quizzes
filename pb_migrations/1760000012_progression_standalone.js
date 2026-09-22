/// <reference path="../pb_data/types.d.ts" />

// Assigning a single quiz on its own creates a learning path holding just that
// quiz, so the whole student pipeline (step -> enrollment -> attempt) carries it
// without a second one being built beside the first. This flag is what keeps
// those hidden paths out of every list of learning paths the teacher sees.
// See docs/adr/0002-one-off-quizzes-are-hidden-single-step-paths.md.
migrate((app) => {
  const progressions = app.findCollectionByNameOrId("progressions");
  progressions.fields.add(new Field({ name: "standalone", type: "bool" }));
  app.save(progressions);
}, (app) => {
  const progressions = app.findCollectionByNameOrId("progressions");
  // The hidden paths themselves have to go with the flag: without it they would
  // surface in every teacher's list as a path per assigned quiz. Their steps,
  // enrollments and attempts cascade away with them.
  app.db().newQuery("DELETE FROM progressions WHERE standalone = TRUE").execute();
  progressions.fields.removeByName("standalone");
  app.save(progressions);
});
