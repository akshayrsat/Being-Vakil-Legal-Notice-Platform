// Cookie flags for the sign-in session.
// Production and an https public base URL both mark the cookie Secure.

export function sessionCookieSecure(env: { nodeEnv?: string; publicBaseUrl?: string } = {}): boolean {
  if (env.nodeEnv === "production") return true;
  return (env.publicBaseUrl ?? "").trim().toLowerCase().startsWith("https://");
}

export function sessionCookieOptions(input: {
  secure: boolean;
  maxAge: number;
}): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: input.secure,
    path: "/",
    maxAge: input.maxAge,
  };
}
