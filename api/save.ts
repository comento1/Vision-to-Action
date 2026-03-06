const SHEET_API_URL = process.env.VITE_SHEET_API_URL || "https://script.google.com/macros/s/AKfycbyPCZRENZ__YkgqrQ_ixO8GuXFaKrcfta-3Oprze_YcDMwpjKlxpRPoKr_vBJ2qJ2OP/exec";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(SHEET_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return new Response(JSON.stringify(data || { error: "Sheet API error" }), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
