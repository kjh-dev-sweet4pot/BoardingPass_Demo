import { NextResponse } from "next/server";
import { AUTH_TOKEN_COOKIE, INF_COOKIE } from "@/lib/session";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const response = NextResponse.redirect(new URL("/inf", origin), 303);
  for (const name of [INF_COOKIE, AUTH_TOKEN_COOKIE]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}
