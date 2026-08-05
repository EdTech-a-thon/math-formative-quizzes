migrate((app) => {
  const enrollments = app.findCollectionByNameOrId("progression_enrollments");
  enrollments.fields.add(new Field({ name: "released", type: "bool" }));
  app.save(enrollments);
}, (app) => {
  const enrollments = app.findCollectionByNameOrId("progression_enrollments");
  enrollments.fields.removeByName("released");
  app.save(enrollments);
});
