import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const DEFAULT_SECRET = "change-this-to-a-super-secret-32-byte-hex-key-in-production";
const secretStr = process.env.JWT_SECRET || process.env.SECRET_KEY || DEFAULT_SECRET;
const JWT_SECRET = new TextEncoder().encode(secretStr);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;


  // Return a true HTTP 404 page without redirecting the browser URL
  const sendNotFound = () => {
    const url = request.nextUrl.clone();
    url.pathname = "/_not-found";
    return NextResponse.rewrite(url, { status: 404 });
  };

  const token = request.cookies.get("finsight_token")?.value;
  if (!token) {
    return sendNotFound();
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "super_admin") {
      return sendNotFound();
    }
  } catch {
    // Malformed, tampered, or expired token
    return sendNotFound();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
