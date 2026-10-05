/// <reference path="../pb_data/types.d.ts" />

// A quiz used to belong to one class, so a teacher with four classes ended up
// with four copies of every quiz and had to make the same edit four times.
// Ownership moves to the teacher: one quiz record can now be referenced by the
// learning paths of as many of her classes as she likes. Learning paths stay
// per class. See docs/adr/0001-quizzes-belong-to-the-teacher.md.
migrate((app) => {
  const setOwnerRules = (collection, rule) => {
    collection.listRule = rule;
    collection.viewRule = rule;
    collection.createRule = rule;
    collection.updateRule = rule;
    collection.deleteRule = rule;
  };

  const teachers = app.findCollectionByNameOrId("teachers");
  const quizzes = app.findCollectionByNameOrId("quizzes");

  quizzes.fields.add(new Field({
    name: "teacher",
    type: "relation",
    required: true,
    collectionId: teachers.id,
    maxSelect: 1,
    cascadeDelete: true,
  }));
  app.save(quizzes);

  // Every existing quiz is inherited by the teacher who owns the class it sat
  // in. Done in SQL so the whole table moves in one statement inside the
  // migration's transaction.
  app.db()
    .newQuery("UPDATE quizzes SET teacher = (SELECT classes.teacher FROM classes WHERE classes.id = quizzes.class)")
    .execute();

  // A quiz whose class had already vanished has no owner to inherit, and an
  // unowned quiz would be invisible to everybody. Stop rather than drop the
  // class field and lose the only remaining clue about where it came from.
  const unowned = new DynamicModel({ count: 0 });
  app.db()
    .newQuery("SELECT COUNT(*) AS count FROM quizzes WHERE teacher IS NULL OR teacher = ''")
    .one(unowned);
  if (unowned.count > 0) throw new Error(`${unowned.count} quizzes have no class to inherit a teacher from.`);

  setOwnerRules(quizzes, "teacher = @request.auth.id");
  quizzes.fields.removeByName("class");
  app.save(quizzes);

  // Attempts and assignments reached the teacher by hopping quiz -> class ->
  // teacher, so their rules have to follow the quiz's new owner or they stop
  // matching anything at all.
  for (const name of ["quiz_attempts", "quiz_assignments"]) {
    const collection = app.findCollectionByNameOrId(name);
    setOwnerRules(collection, "quiz.teacher = @request.auth.id");
    app.save(collection);
  }
}, (app) => {
  const setOwnerRules = (collection, rule) => {
    collection.listRule = rule;
    collection.viewRule = rule;
    collection.createRule = rule;
    collection.updateRule = rule;
    collection.deleteRule = rule;
  };

  const classes = app.findCollectionByNameOrId("classes");
  const quizzes = app.findCollectionByNameOrId("quizzes");

  quizzes.fields.add(new Field({
    name: "class",
    type: "relation",
    required: true,
    collectionId: classes.id,
    maxSelect: 1,
    cascadeDelete: true,
  }));
  app.save(quizzes);

  // The old shape allows a quiz exactly one class, so going back has to pick
  // one: the class of the first learning path using the quiz, or failing that
  // the teacher's oldest class.
  app.db()
    .newQuery(`
      UPDATE quizzes SET class = COALESCE(
        (SELECT progressions.class
           FROM progression_steps
           JOIN progressions ON progressions.id = progression_steps.progression
          WHERE progression_steps.quiz = quizzes.id
          ORDER BY progression_steps.position
          LIMIT 1),
        (SELECT classes.id FROM classes WHERE classes.teacher = quizzes.teacher ORDER BY classes.id LIMIT 1),
        ''
      )
    `)
    .execute();

  // A quiz belonging to a teacher with no classes at all cannot be expressed in
  // the old shape, so it cannot come back with us.
  app.db().newQuery("DELETE FROM quizzes WHERE class IS NULL OR class = ''").execute();

  setOwnerRules(quizzes, "class.teacher = @request.auth.id");
  quizzes.fields.removeByName("teacher");
  app.save(quizzes);

  for (const name of ["quiz_attempts", "quiz_assignments"]) {
    const collection = app.findCollectionByNameOrId(name);
    setOwnerRules(collection, "quiz.class.teacher = @request.auth.id");
    app.save(collection);
  }
});
