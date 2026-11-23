/**
 * Locks the whole internal site (pages, JavaScript, data files and APIs) behind company
 * credentials. Without INTERNAL_ACCESS_USER and INTERNAL_ACCESS_PASSWORD it fails closed.
 */
export const config = { matcher: "/:path*" };

const digest = async (s: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));

async function sameSecret(a: string, b: string) {
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  return x.reduce((diff, v, i) => diff | (v ^ y[i]), 0) === 0;
}

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

export default async function middleware(request: Request): Promise<Response> {
  const user = process.env.INTERNAL_ACCESS_USER;
  const password = process.env.INTERNAL_ACCESS_PASSWORD;
  if (!user || !password || password.length < 16) return new Response("Access is not configured.", { status: 503, headers: NO_STORE });

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    let decoded = "";
    try {
      decoded = atob(header.slice(6));
    } catch {
      /* malformed credentials are rejected below */
    }
    const split = decoded.indexOf(":");
    if (split > 0) {
      const [userOk, passwordOk] = await Promise.all([sameSecret(decoded.slice(0, split), user), sameSecret(decoded.slice(split + 1), password)]);
      if (userOk && passwordOk) return new Response(null, { headers: { "x-middleware-next": "1" } });
    }
  }
  return new Response("Authentication required.", { status: 401, headers: { ...NO_STORE, "WWW-Authenticate": 'Basic realm="TruMarket internal", charset="UTF-8"' } });
}
