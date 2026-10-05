/// <reference path="../pb_data/types.d.ts" />

// Remove a student from their class, optionally merging their work into another
// student in the same class first (for a duplicate student). Everything runs in
// one transaction so a merge is never left half done.
//
// Merging, for each learning path the duplicate is on:
// - the kept student is not on it: the duplicate's enrollment moves across.
// - both are on it: whichever enrollment is further along survives, and every
//   attempt from both lands on it. A tie keeps the kept student's.
// The kept student's name and accommodations are never touched.
routerAdd("POST", "/api/fact-friends/remove-student", (e) => {
  const data = new DynamicModel({ studentId: "", mergeIntoId: "" });
  e.bindBody(data);

  function ownedStudent(id) {
    let student;
    try {
      student = e.app.findRecordById("students", id);
    } catch (_) {
      throw new NotFoundError("We could not find this student.");
    }
    const classRoom = e.app.findRecordById("classes", student.getString("class"));
    if (classRoom.getString("teacher") !== e.auth.id) throw new NotFoundError("We could not find this student.");
    return student;
  }

  const duplicate = ownedStudent((data.studentId || "").trim());
  const mergeIntoId = (data.mergeIntoId || "").trim();
  const kept = mergeIntoId ? ownedStudent(mergeIntoId) : null;
  if (kept && kept.id === duplicate.id) throw new BadRequestError("Pick a different student to move this work to.");
  if (kept && kept.getString("class") !== duplicate.getString("class")) throw new BadRequestError("Both students need to be in the same class.");

  e.app.runInTransaction((txApp) => {
    if (kept) require(`${__hooks}/merge_student.js`)(txApp, duplicate, kept);
    txApp.delete(txApp.findRecordById("students", duplicate.id));
  });

  return e.json(200, { ok: true });
}, $apis.requireAuth("teachers"));
