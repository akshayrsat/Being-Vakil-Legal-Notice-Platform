// Password checks for sign-in.
// bcryptjs is imported only when a form is submitted. Loading it while /login
// renders used to hash a dummy password at module scope. That runs as soon as
// the sign-in form is drawn (after the staff entry code). On Cloud Run the
// hash throws when the crypto bridge is missing, and the error page opens
// instead of the email and password fields.

// A valid bcrypt hash that does not match a real password. Comparing against
// it keeps unknown emails on the same code path as a real account.
const UNKNOWN_EMAIL_HASH = "$2b$10$1cwaOC/UPwZS19pub9F8X.9CyKuxJFQtnzg2IUagJy15Ky.zMVOQ6";

type BcryptApi = {
  compare: (password: string, hash: string) => Promise<boolean>;
};

async function bcryptApi(): Promise<BcryptApi> {
  const loaded = (await import("bcryptjs")) as {
    compare?: BcryptApi["compare"];
    default?: BcryptApi;
  };
  if (typeof loaded.compare === "function") return loaded as BcryptApi;
  if (loaded.default && typeof loaded.default.compare === "function") return loaded.default;
  throw new Error("bcryptjs did not load");
}

export async function passwordMatches(password: string, storedHash: string | null): Promise<boolean> {
  const api = await bcryptApi();
  return api.compare(password, storedHash ?? UNKNOWN_EMAIL_HASH);
}
