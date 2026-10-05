/// <reference path="../pb_data/types.d.ts" />

// Move a duplicate student's enrollments and attempts onto the kept student.
// See remove_student.pb.js for the rules. Runs inside the caller's transaction.
module.exports = function mergeStudent(app, duplicate, kept) {
  // How far along an enrollment is: a finished path beats any step.
  function progress(enrollment) {
    if (enrollment.getString("status") === "completed") return Number.MAX_SAFE_INTEGER;
    const stepId = enrollment.getString("currentStep");
    if (!stepId) return 0;
    try {
      return app.findRecordById("progression_steps", stepId).getInt("position");
    } catch (_) {
      return 0;
    }
  }

  function moveAttempts(fromEnrollment, toEnrollment) {
    const attempts = app.findRecordsByFilter("quiz_attempts", "progressionEnrollment = {:e}", "", 0, 0, { e: fromEnrollment.id });
    for (const attempt of attempts) {
      attempt.set("progressionEnrollment", toEnrollment.id);
      app.save(attempt);
    }
  }

  const enrollments = app.findRecordsByFilter("progression_enrollments", "student = {:s}", "", 0, 0, { s: duplicate.id });
  for (const enrollment of enrollments) {
    let keptEnrollment = null;
    try {
      keptEnrollment = app.findFirstRecordByFilter(
        "progression_enrollments",
        "student = {:s} && progression = {:p}",
        { s: kept.id, p: enrollment.getString("progression") },
      );
    } catch (_) {}

    if (keptEnrollment && progress(enrollment) > progress(keptEnrollment)) {
      // The duplicate got further. Its enrollment takes over, so the kept
      // student's older one hands over its attempts and makes way.
      moveAttempts(keptEnrollment, enrollment);
      app.delete(keptEnrollment);
      keptEnrollment = null;
    }

    if (keptEnrollment) {
      moveAttempts(enrollment, keptEnrollment);
      app.delete(enrollment);
    } else {
      enrollment.set("student", kept.id);
      app.save(enrollment);
    }
  }

  const attempts = app.findRecordsByFilter("quiz_attempts", "student = {:s}", "", 0, 0, { s: duplicate.id });
  for (const attempt of attempts) {
    attempt.set("student", kept.id);
    app.save(attempt);
  }
}
