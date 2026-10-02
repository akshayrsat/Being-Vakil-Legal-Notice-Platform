// Reads the staff-door cookie. Setting it happens only in the unlock action.

import { cookies } from "next/headers";
import { STAFF_GATE_COOKIE, staffGateTokenValid } from "./staff-gate";

export async function staffGateIsOpen(): Promise<boolean> {
  const cookieStore = await cookies();
  return staffGateTokenValid(cookieStore.get(STAFF_GATE_COOKIE)?.value);
}
