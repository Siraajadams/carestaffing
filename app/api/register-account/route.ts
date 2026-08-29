import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.text();

  const url = new URL("/api/register-worker", request.url);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    cache: "no-store",
  });

  const text = await response.text();

  return new Response(text, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("content-type") ||
        "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  const url = new URL("/api/register-worker", request.url);

  return fetch(url, {
    method: "GET",
    cache: "no-store",
  });
}
