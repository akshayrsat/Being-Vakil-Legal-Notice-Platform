// The home screen after sign-in. If nobody is signed in, this sends them to the sign-in page.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardHome } from "@/components/dashboard-home";
import { getCurrentUser } from "@/lib/auth";
import { liveSendIsOn } from "@/lib/live-send-store";

export const metadata: Metadata = {
  title: "Signed in",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const liveSendOn = await liveSendIsOn();

  return <DashboardHome user={user} liveSendOn={liveSendOn} />;
}
