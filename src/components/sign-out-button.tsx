// The Sign out button. It shows "Signing out…" while the site is closing the visit.

"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="outline"
      className="h-11 px-4"
      disabled={pending}
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
