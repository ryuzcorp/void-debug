// The action body decoder. @ilha/void's hydrated useForm submits JSON; a
// plain <form> posts form data. Hono's parseBody() only decodes the latter
// and returns {} for JSON, so a JSON action silently saw no intent.
export type ActionBodyRequest = {
  header(name: string): string | undefined;
  json(): Promise<unknown>;
  parseBody(): Promise<Record<string, unknown>>;
};

export async function readActionBody(req: ActionBodyRequest): Promise<Record<string, unknown>> {
  const contentType = req.header("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => null);
    return body !== null && typeof body === "object" ? (body as Record<string, unknown>) : {};
  }
  return req.parseBody();
}
