# Quizzes belong to the teacher, learning paths belong to a class

A teacher with four classes had four separate copies of every quiz, because
creating a class minted a fresh learning path *and* a fresh set of quizzes. She
fixed a question in one class and found the other three unchanged. We moved
quiz ownership from the class to the teacher (`quizzes.class` becomes
`quizzes.teacher`), so one quiz record can be referenced by the paths of several
classes and an edit reaches all of them. Learning paths stay per class.

## Considered Options

We first designed the opposite: sharing the *path* across classes, via a
`progression_offerings` join record holding each class's passing score and
pacing. It was rejected once we re-read the teacher's words — she complained
about quiz content and never about the sequence. Sharing paths would also have
meant class-scoped release, per-class delivery settings, and a reordering hazard
where one drag relocates students in three classes at once. Sharing only the
quizzes gets what she asked for and none of that.

## Consequences

- An edit to a quiz reaches every class using it. That is the point, but it
  means the editor has to show the reach ("Used in 4 classes"), and tweaking a
  quiz for one class only now requires an explicit "make a separate copy"
  action, which is a plain copy with no link back to the original.
- Deleting a class no longer destroys its quizzes. They survive as the
  teacher's; the class's path, steps, enrollments and attempts still cascade.
- "Delete quiz" and "remove this quiz from the path" become genuinely different
  actions. From inside a class the second is almost always what is meant.
- Teachers who already have duplicate quizzes keep them. Merging them means
  repointing `progression_steps.quiz` and `quiz_attempts.quiz` and picking a
  survivor among copies that differ — deliberately deferred, not designed.
- Every teacher's library holds one copy of each ready-made quiz, marked by
  `quizzes.starter` ("multiplication:3"). Picking a ready-made path during
  class setup builds a new path whose steps point at those library quizzes,
  edits included. This is what stops duplicates coming back. (An earlier
  version instead offered her existing paths from other classes at setup;
  teachers found that choice confusing, so it was removed.)
