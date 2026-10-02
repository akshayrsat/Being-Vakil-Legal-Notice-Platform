import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { EntryForm } from "@/components/entry-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { entryGateEnabled, safeNextPath } from "@/lib/entry-gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Staff entry",
};

export default async function EnterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (!entryGateEnabled()) redirect("/login");
  const query = await searchParams;
  const nextPath = safeNextPath(query.next ?? "/login");

  return (
    <div className="flex min-h-full flex-col">
      <div className="h-2 bg-[#5b2c83]" />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <Image src="/branding/letterhead-mark.png" alt="" width={48} height={48} className="h-12 w-12 object-contain" />
        <h1 className="mt-4 font-serif text-4xl tracking-tight text-primary">Staff entry</h1>
        <p className="mt-2 text-base leading-7 text-muted-foreground">
          Enter the office code to open sign-in. Notice links sent to customers do not need this code.
        </p>
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Entry code</CardTitle>
            <CardDescription>The code is kept on the server. It is not stored in this page.</CardDescription>
          </CardHeader>
          <CardContent>
            <EntryForm nextPath={nextPath} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
