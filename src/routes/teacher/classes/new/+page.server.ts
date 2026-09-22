import { pocketBaseUrl, teacherAuthorization } from "$lib/server/pocketbase";
import { redirect } from "@sveltejs/kit";

type ClassRecord = { id: string; name: string };
type Progression = { id: string; class: string; name: string };
type Step = { progression: string };

export async function load({ locals, cookies }) {
  if (!locals.teacher) redirect(303, "/teacher");
  const authorization = teacherAuthorization(cookies);
  const headers = { Authorization: authorization };
  // Her own classes and paths, so setup can offer the practice she already
  // built alongside the four ready-made paths. PocketBase's access rules have
  // already narrowed all of this to hers.
  const [classesResponse, progressionsResponse, stepsResponse] = await Promise.all([
    globalThis.fetch(`${pocketBaseUrl}/api/collections/classes/records?perPage=500`, { headers }),
    // Newest path first. No record in this database carries a timestamp — not
    // even a created or updated one — so the row order is the only account of
    // recency there is. It puts the path she built most recently at the top;
    // re-editing an older path does not move it back up.
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progressions/records?perPage=500&sort=${encodeURIComponent("-@rowid")}`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progression_steps/records?perPage=500&fields=progression`, { headers }),
  ]);
  const classes = classesResponse.ok ? await classesResponse.json() : { items: [], totalItems: 0 };
  const progressions: Progression[] = progressionsResponse.ok ? (await progressionsResponse.json()).items : [];
  const steps: Step[] = stepsResponse.ok ? (await stepsResponse.json()).items : [];

  const classNames = new Map<string, string>((classes.items as ClassRecord[]).map((held) => [held.id, held.name]));
  const quizCounts = new Map<string, number>();
  for (const step of steps) quizCounts.set(step.progression, (quizCounts.get(step.progression) ?? 0) + 1);

  // Each one labelled with the class it comes from: four similar
  // multiplication paths are otherwise impossible to tell apart.
  const existingPaths = progressions
    .filter((progression) => classNames.has(progression.class))
    .map((progression) => ({
      id: progression.id,
      name: progression.name,
      className: classNames.get(progression.class) ?? "",
      quizCount: quizCounts.get(progression.id) ?? 0,
    }));

  return { defaultClassName: `Class ${classes.totalItems + 1}`, existingPaths };
}
