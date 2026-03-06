const SHEET_API_URL = process.env.VITE_SHEET_API_URL || "https://script.google.com/macros/s/AKfycbyPCZRENZ__YkgqrQ_ixO8GuXFaKrcfta-3Oprze_YcDMwpjKlxpRPoKr_vBJ2qJ2OP/exec";

export async function GET() {
  try {
    const res = await fetch(SHEET_API_URL, { cache: "no-store" });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Sheet API returned ${res.status}` }), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    const data = await res.json();
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
