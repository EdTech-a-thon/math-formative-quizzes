import { error } from "@sveltejs/kit";

export const pocketBaseUrl = "http://127.0.0.1:8090";

type Cookies = { get(name: string): string | undefined };

type PocketBaseRequestOptions = RequestInit & {
  errorMessage?: string;
  preferErrorMessage?: boolean;
};

export class PocketBaseRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown = {},
  ) {
    super(message);
  }
}

// All teacher-only PocketBase calls get their session here, so routes do not
// need to know which cookie holds it or how PocketBase expects it.
export function optionalTeacherAuthorization(cookies: Cookies) {
  const token = cookies.get("teacher_session");
  return token ? `Bearer ${token}` : null;
}

export function teacherAuthorization(cookies: Cookies) {
  const authorization = optionalTeacherAuthorization(cookies);
  if (!authorization) error(401, "Please sign in again.");
  return authorization;
}

// PocketBase returns useful error messages in a JSON body. Keep that detail in
// one place while letting each caller retain its existing fallback wording.
export async function pocketBaseRequest<T>(
  path: string,
  { errorMessage = "PocketBase request failed.", preferErrorMessage = false, ...init }: PocketBaseRequestOptions = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${pocketBaseUrl}${path}`, init);
  } catch {
    throw new PocketBaseRequestError(errorMessage, 500);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = !preferErrorMessage && typeof body.message === "string" ? body.message : errorMessage;
    throw new PocketBaseRequestError(message, response.status, body);
  }
  return body as T;
}

export async function teacherPocketBaseRequest<T>(
  cookies: Cookies,
  path: string,
  { headers, ...init }: PocketBaseRequestOptions = {},
): Promise<T> {
  return pocketBaseRequest<T>(path, {
    ...init,
    headers: {
      Authorization: teacherAuthorization(cookies),
      ...headers,
    },
  });
}

export function pocketBaseError(caught: unknown, fallback: string) {
  if (caught instanceof PocketBaseRequestError) {
    return { message: caught.message, status: caught.status };
  }
  return { message: fallback, status: 500 };
}
