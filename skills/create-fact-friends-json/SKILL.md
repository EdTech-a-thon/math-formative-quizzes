---
name: create-fact-friends-json
description: Create valid JSON files that teachers can import into Fact Friends as a quiz or an ordered progression of quizzes. Use when asked to generate, revise, or explain import-ready quiz or progression JSON for this platform.
---

# Create Fact Friends JSON

Create one JSON object per file. Use a quiz object for one quiz or a progression object for an ordered learning path. Return valid JSON with no comments or trailing commas.

## Create a quiz

Use this shape:

```json
{
  "title": "Mixed addition practice",
  "timeLimitMinutes": 3,
  "showScore": true,
  "passMessage": "Great work! You finished this quiz.",
  "problems": [
    { "id": "q1", "op": "addition", "top": 4, "bottom": 3 },
    { "id": "q2", "op": "subtraction", "top": 9, "bottom": 5 }
  ]
}
```

Include at least one problem. Give every problem a unique string `id`. Set `op` to exactly one of:

- `addition`
- `subtraction`
- `multiplication`
- `division`

Use numbers for `top` and `bottom`. Write subtraction with the larger number first. Make division answers whole numbers and never divide by zero.

## Create a progression

Put complete quiz objects inside `quizzes` in the order students should complete them:

```json
{
  "name": "Build multiplication confidence",
  "description": "Start with twos, then practise fives.",
  "passPercentage": 80,
  "quizzes": [
    {
      "title": "Multiply by 2",
      "timeLimitMinutes": 2,
      "showScore": true,
      "passMessage": "Twos complete!",
      "problems": [
        { "id": "twos-1", "op": "multiplication", "top": 2, "bottom": 4 },
        { "id": "twos-2", "op": "multiplication", "top": 2, "bottom": 7 }
      ]
    },
    {
      "title": "Multiply by 5",
      "timeLimitMinutes": 2,
      "showScore": true,
      "passMessage": "Fives complete!",
      "problems": [
        { "id": "fives-1", "op": "multiplication", "top": 5, "bottom": 3 },
        { "id": "fives-2", "op": "multiplication", "top": 5, "bottom": 8 }
      ]
    }
  ]
}
```

Include at least one quiz. `passPercentage` applies to every step in the progression.

## Apply defaults and limits

Prefer writing every field shown above. If optional fields are omitted, the importer uses these defaults:

- `title`: `"Untitled quiz"`
- `timeLimitMinutes`: `2` (accepted range: 1–60)
- `showScore`: `true`
- `passMessage`: `"Great work! You finished this quiz."`
- `name`: `"Untitled path"`
- `description`: empty text
- `passPercentage`: `80` (accepted range: 1–100)

Keep a quiz at 500 problems or fewer and a progression at 100 quizzes or fewer. A JSON file imports one quiz or one progression. Re-importing adds another copy; it does not update the original.

## Check the result

Before returning or saving the JSON:

1. Parse it as JSON.
2. Confirm the top-level object has either `problems` or `quizzes`.
3. Confirm every quiz has at least one valid problem.
4. Confirm all problem IDs within each quiz are unique.
5. Save it with a `.json` filename, or give it as plain JSON for the teacher to paste into the Import window.
