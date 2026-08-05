// The four colours the app ships with. They are the same values the operation
// palettes use, so a chosen shade slots straight into the existing
// --operation / --operation-soft custom properties everything already reads.
export const shades = [
  { id: "purple", label: "Purple", color: "#7456e8", soft: "#eee9ff" },
  { id: "blue", label: "Blue", color: "#2a83b8", soft: "#e5f4fb" },
  { id: "orange", label: "Orange", color: "#d77a25", soft: "#fff0df" },
  { id: "pink", label: "Pink", color: "#cc5470", soft: "#fff0f3" },
] as const;

export type ShadeId = (typeof shades)[number]["id"];

export function isShade(value: unknown): value is ShadeId {
  return shades.some((shade) => shade.id === value);
}

// The class that recolours a card, pill or preview. Falls back to the
// operation's own palette when no shade has been chosen.
export function shadeClass(shade: unknown, operation?: string) {
  if (isShade(shade)) return `shade-${shade}`;
  return operation ? `op-${operation}` : "";
}
