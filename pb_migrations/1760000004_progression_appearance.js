/// <reference path="../pb_data/types.d.ts" />

// Teachers can give a progression its own Lucide icon and colour. Quizzes keep
// the same two settings inside their existing `data` JSON, so only progressions
// need columns here. Both are optional — an unset icon falls back to the route
// glyph, an unset shade to the progression's operation palette.
migrate((app) => {
  const progressions = app.findCollectionByNameOrId("progressions");
  progressions.fields.add(new Field({ name: "icon", type: "text", max: 60 }));
  progressions.fields.add(new Field({
    name: "shade",
    type: "select",
    maxSelect: 1,
    values: ["purple", "blue", "orange", "pink"],
  }));
  app.save(progressions);
}, (app) => {
  const progressions = app.findCollectionByNameOrId("progressions");
  progressions.fields.removeByName("icon");
  progressions.fields.removeByName("shade");
  app.save(progressions);
});
