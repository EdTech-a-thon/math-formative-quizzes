// Find the enrollment that lets this student sit this step, along with the step,
// its progression and the whole ladder. Returns null when the student was never
// assigned this work, or has already moved past it.
module.exports = function studentStep(app, studentId, stepId) {
  let student, step, progression, steps;
  try {
    student = app.findRecordById("students", studentId);
    step = app.findRecordById("progression_steps", stepId);
    progression = app.findRecordById("progressions", step.getString("progression"));
    steps = app.findRecordsByFilter("progression_steps", "progression = {:p}", "position", 500, 0, { p: progression.id });
  } catch (_) {
    return null;
  }

  let enrollment = null;
  try {
    enrollment = app.findFirstRecordByFilter("progression_enrollments", "student = {:s} && progression = {:p}", { s: student.id, p: progression.id });
  } catch (_) {
    return null;
  }
  if (!enrollment || enrollment.getString("status") === "completed" || !enrollment.getBool("released")) return null;

  // Students only ever sit the step they are currently on.
  const currentStepId = enrollment.getString("currentStep") || (steps.length ? steps[0].id : "");
  if (currentStepId !== step.id) return null;

  let position = 1;
  for (let index = 0; index < steps.length; index++) {
    if (steps[index].id === step.id) position = index + 1;
  }
  return { student: student, step: step, progression: progression, steps: steps, enrollment: enrollment, position: position };
};
