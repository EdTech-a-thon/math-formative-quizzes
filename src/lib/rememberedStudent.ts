import { browser } from "$app/environment";

// "Remember me on this device" for students. This is only a convenience so a
// student does not retype their class code and name every time, so it lives in
// the browser's own storage rather than in the database.
const storageKey = "fact-friends-student";

export type RememberedStudent = { classCode: string; className: string; name: string };

export function readRememberedStudent(): RememberedStudent | null {
  if (!browser) return null;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!saved || !saved.classCode || !saved.name) return null;
    return { classCode: String(saved.classCode), className: String(saved.className || ""), name: String(saved.name) };
  } catch {
    return null;
  }
}

export function rememberStudent(student: RememberedStudent) {
  if (!browser) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(student));
  } catch {
    // Some browsers block storage in private mode. Signing in still works, the
    // student is just not remembered, so there is nothing to tell them here.
  }
}

export function forgetStudent() {
  if (!browser) return;
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // Nothing was stored, so there is nothing to clear.
  }
}
