/// <reference path="../pb_data/types.d.ts" />

// Every teacher's library holds one copy of each ready-made quiz, and a new
// class picking a ready-made path reuses those copies rather than minting more.
// This field is how the app recognises them: "multiplication:3" is the third
// quiz of the ready-made multiplication path. It survives the teacher editing
// the quiz, so her edits carry into every class she starts later.
migrate((app) => {
  const quizzes = app.findCollectionByNameOrId("quizzes");
  quizzes.fields.add(new Field({ name: "starter", type: "text" }));
  app.save(quizzes);
}, (app) => {
  const quizzes = app.findCollectionByNameOrId("quizzes");
  quizzes.fields.removeByName("starter");
  app.save(quizzes);
});
