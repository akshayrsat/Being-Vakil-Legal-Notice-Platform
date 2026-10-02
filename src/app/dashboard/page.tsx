// The home screen after sign-in. If nobody is signed in, this sends them to the sign-in page.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardHome } from "@/components/dashboard-home";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Signed in",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <DashboardHome user={user} />;
}
