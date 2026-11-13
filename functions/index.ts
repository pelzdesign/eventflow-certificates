export async function onRequestGet(): Promise<Response> {
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/login",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}
