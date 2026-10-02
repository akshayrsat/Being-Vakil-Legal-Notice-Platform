// When NOTICE_DESK_ENTRY_CODE is set, staff pages ask for it first.
// Public notice links and the MSG91 webhook stay open. An unset code changes nothing.

import { NextResponse, type NextRequest } from "next/server";
import { ENTRY_COOKIE, entryCookieMatches, entryGateEnabled, isStaffPath, safeNextPath } from "@/lib/entry-gate";

export function proxy(request: NextRequest) {
  if (!entryGateEnabled()) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  if (!isStaffPath(pathname)) return NextResponse.next();
  if (entryCookieMatches(request.cookies.get(ENTRY_COOKIE)?.value)) return NextResponse.next();

  const enter = new URL("/enter", request.url);
  enter.searchParams.set("next", safeNextPath(`${pathname}${search}`));
  return NextResponse.redirect(enter);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|branding/|favicon.ico|icon.png|apple-icon.png).*)"],
};
