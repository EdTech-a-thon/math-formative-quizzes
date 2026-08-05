import { writable } from "svelte/store";

export type ToastKind = "error" | "success";
export type Toast = { id: number; kind: ToastKind; message: string; detail: string };

export const toasts = writable<Toast[]>([]);

let nextId = 0;

export function dismissToast(id: number) {
  toasts.update((list) => list.filter((toast) => toast.id !== id));
}

// Something went right: say so briefly and get out of the way. Something went
// wrong: stay put until it is read, because the message is the only clue about
// what to do differently.
export function pushToast(kind: ToastKind, message: string, detail = "") {
  const id = (nextId += 1);
  toasts.update((list) => [...list, { id, kind, message, detail }]);
  if (kind === "success") setTimeout(() => dismissToast(id), 5000);
  return id;
}
