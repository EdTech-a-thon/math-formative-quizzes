/// <reference path="../pb_data/types.d.ts" />

// How questions are shown belongs to the learning path, not to each quiz: a
// student working through a path should meet every step the same way. Unset
// means the whole sheet at once, which is what every existing path gets.
migrate((app) => {
  const progressions = app.findCollectionByNameOrId("progressions");
  progressions.fields.add(new Field({ name: "oneAtATime", type: "bool" }));
  app.save(progressions);
}, (app) => {
  const progressions = app.findCollectionByNameOrId("progressions");
  progressions.fields.removeByName("oneAtATime");
  app.save(progressions);
});
