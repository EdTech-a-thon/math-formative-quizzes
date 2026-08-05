migrate((app) => {
  const teachers = app.findCollectionByNameOrId("teachers");
  const appState = new Collection({
    type: "base",
    name: "app_state",
    listRule: "teacher = @request.auth.id",
    viewRule: "teacher = @request.auth.id",
    createRule: "teacher = @request.auth.id",
    updateRule: "teacher = @request.auth.id",
    deleteRule: "teacher = @request.auth.id",
    fields: [
      { name: "teacher", type: "relation", required: true, collectionId: teachers.id, maxSelect: 1, cascadeDelete: true },
      { name: "data", type: "json", required: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_app_state_teacher ON app_state (teacher)"],
  });
  app.save(appState);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("app_state"));
});
