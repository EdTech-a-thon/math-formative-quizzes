# A one-off quiz assignment is a hidden single-step learning path

Teachers need to assign a single quiz without building a path for it. Every
student-facing endpoint is keyed on a step and an enrollment — `quiz-step`,
`record-attempt` and `attempt-review` all resolve through `student_step.js` — so
a quiz with no path can't reach a student without a second pipeline beside the
first. Instead, assigning a one-off creates a learning path containing that one
quiz, flagged `standalone` so it stays out of the paths list. The teacher never
sees the word path; a small dialog collects the passing score and pacing before
assigning.

## Considered Options

The schema has carried an unused `quiz_assignments` collection (quiz × student ×
status) since the first migration, with zero references anywhere in the app.
Reviving it would model the concept honestly but needs parallel handling in all
three student endpoints plus `student-home`, for behaviour a one-step path
already provides.

## Consequences

- A one-off inherits retry-until-passed, because that is what a one-step path
  does. It is not a single sitting, and the assign dialog should not imply it is.
- It defaults to self-paced. A teacher assigning one quiz does not expect to
  then go and press Release before anyone can start — this is the one place the
  trick leaks, and self-paced is what plugs it.
- Anything listing paths must filter out `standalone` ones, or teachers will see
  a path per assigned quiz.
