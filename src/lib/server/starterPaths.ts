import addition from "../../../addition-0-to-12-progression.json";
import subtraction from "../../../subtraction-0-to-12-progression.json";
import multiplication from "../../../multiplication-0-to-12-progression.json";
import division from "../../../division-1-to-12-progression.json";
import { readProgressionRecord } from "$lib/server/exportRecord";

const files = { addition, subtraction, multiplication, division };
export type StarterPath = keyof typeof files;

export function isStarterPath(value: unknown): value is StarterPath {
  return typeof value === "string" && Object.hasOwn(files, value);
}

export function starterProgression(key: StarterPath) {
  const progression = readProgressionRecord(files[key]);
  if (!progression) throw new Error(`The ${key} starter path could not be read.`);
  return progression;
}
