// One wording for the result of an assignment, so the picker reports the same
// thing whether it was opened from the roster, a progression or a student.
export function assignmentSummary(assigned: number, skipped: number) {
  if (!assigned) return "Everyone you picked was already assigned.";
  const made = `${assigned} new ${assigned === 1 ? "assignment" : "assignments"}`;
  return skipped ? `Added ${made}. ${skipped} ${skipped === 1 ? "was" : "were"} already in place.` : `Added ${made}.`;
}
