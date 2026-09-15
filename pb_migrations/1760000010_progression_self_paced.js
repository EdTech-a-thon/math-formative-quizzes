migrate((app) => {
  const progressions = app.findCollectionByNameOrId("progressions");
  // Self-paced paths automatically make the next attempt available after a
  // student submits, instead of waiting for a teacher release.
  progressions.fields.add(new Field({ name: "selfPaced", type: "bool" }));
  app.save(progressions);
}, (app) => {
  const progressions = app.findCollectionByNameOrId("progressions");
  progressions.fields.removeByName("selfPaced");
  app.save(progressions);
});
