const SHEET_API_URL =
  process.env.VITE_SHEET_API_URL ||
  "https://script.google.com/macros/s/AKfycbyPCZRENZ__YkgqrQ_ixO8GuXFaKrcfta-3Oprze_YcDMwpjKlxpRPoKr_vBJ2qJ2OP/exec";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userKey = searchParams.get("userKey") || "";
    const taskId = searchParams.get("taskId");

    const url = new URL(SHEET_API_URL);
    url.searchParams.set("type", "written");
    if (userKey) url.searchParams.set("userKey", userKey);
    if (taskId) url.searchParams.set("taskId", taskId);

    const res = await fetch(url.toString(), { cache: "no-store" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return new Response(JSON.stringify(data || { error: `Sheet API returned ${res.status}` }), {
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

