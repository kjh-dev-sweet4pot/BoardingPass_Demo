import { type NextRequest, NextResponse } from "next/server";

/**
 * Supabase Auth session refresh is not needed for current flows
 * (Admin/Inf use app cookies). Mutating cookies here breaks Server Actions.
 */
export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
