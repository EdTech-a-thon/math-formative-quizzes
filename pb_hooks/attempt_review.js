// A student may only look back at a finished quiz when the path they sat it on
// shows students their answers. Everything a student sees about an old attempt
// goes through here, so that one rule is only written once.

// The progression an attempt was sat on, or null when it cannot be found.
function progressionOf(app, attempt) {
  try {
    const enrollment = app.findRecordById("progression_enrollments", attempt.getString("progressionEnrollment"));
    return app.findRecordById("progressions", enrollment.getString("progression"));
  } catch (_) {
    return null;
  }
}

function showsAnswers(app, attempt) {
  const progression = progressionOf(app, attempt);
  return Boolean(progression && progression.getBool("showAnswers"));
}

// The attempt a student is asking to review, or null when it is not theirs or
// its path keeps answers back.
function reviewable(app, studentId, attemptId) {
  let attempt;
  try {
    attempt = app.findRecordById("quiz_attempts", attemptId);
  } catch (_) {
    return null;
  }
  if (attempt.getString("student") !== studentId) return null;
  const progression = progressionOf(app, attempt);
  if (!progression || !progression.getBool("showAnswers")) return null;
  return { attempt: attempt, progression: progression };
}

module.exports = { showsAnswers: showsAnswers, reviewable: reviewable };
