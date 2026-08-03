import { NextResponse } from "next/server";
import { INF_COOKIE } from "@/lib/session";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const response = NextResponse.redirect(new URL("/inf", origin), 303);
  response.cookies.set(INF_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
