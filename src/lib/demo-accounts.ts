// Practice logins for this first version. There is no real one-time password yet.
// If you change an email or password here, update the README to match.

import { ROLE_BANK_USER, ROLE_OWNER, type AppRole } from "./roles";

export type DemoAccount = {
  role: AppRole;
  name: string;
  email: string;
  password: string;
  who: string;
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: ROLE_OWNER,
    name: "Meera Iyer",
    email: "admin@noticedesk.local",
    password: "admin123",
    who: "Owner",
  },
  {
    role: ROLE_BANK_USER,
    name: "Arjun Kapoor",
    email: "viewer@noticedesk.local",
    password: "viewer123",
    who: "Bank user",
  },
];
