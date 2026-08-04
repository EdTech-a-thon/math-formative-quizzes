import { json } from "@sveltejs/kit";

export async function POST({ request, fetch }) {
  const { classCode } = await request.json();
  const response = await fetch("http://127.0.0.1:8090/api/fact-friends/class-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ classCode }) });
  const body = await response.json();
  return json(body, { status: response.status });
}
