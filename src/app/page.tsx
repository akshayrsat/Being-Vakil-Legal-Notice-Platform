// The front door. If you are already signed in, you go to the dashboard.
// If you are not, you go to the sign-in page.

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
