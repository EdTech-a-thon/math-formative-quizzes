// One wording for the result of an assignment, so the picker reports the same
// thing whether it was opened from the roster, a progression or a student.
export function assignmentSummary(assigned: number, skipped: number) {
  if (!assigned) return "Everyone you picked was already assigned.";
  const made = `${assigned} new ${assigned === 1 ? "assignment" : "assignments"}`;
  return skipped ? `Added ${made}. ${skipped} ${skipped === 1 ? "was" : "were"} already in place.` : `Added ${made}.`;
}

// Sending students to a step tells the teacher how many she just moved, and
// that she does not need to release them afterwards.
export function sendToStepSummary(moved: number, quizTitle: string) {
  const students = `${moved} ${moved === 1 ? "student" : "students"}`;
  return `Moved ${students} to ${quizTitle}. ${moved === 1 ? "They can" : "They can all"} start it right away.`;
}

// Giving a quiz out on its own. The pacing she chose decides the second half of
// this: either nobody is waiting on her, or she still has to say when to start.
export function oneOffSummary(assigned: number, skipped: number, quizTitle: string, selfPaced: boolean) {
  const already = skipped ? ` ${skipped} already had it.` : "";
  if (!assigned) return `Everyone you picked already has ${quizTitle}.`;
  const students = `${assigned} ${assigned === 1 ? "student" : "students"}`;
  const next = selfPaced
    ? `${assigned === 1 ? "They can" : "They can all"} start it right away.`
    : "Release it when you want them to start.";
  return `Gave ${quizTitle} to ${students}. ${next}${already}`;
}
