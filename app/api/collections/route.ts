import { list } from "@vercel/blob";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ID_RE = /^col\/([1-9A-HJ-NP-Za-km-z]{32,44})\/config\.json$/;

export async function GET() {
  try {
    const found: { id: string; url: string; at: number }[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const r = await list({ prefix: "col/", limit: 1000, cursor });
      for (const b of r.blobs) {
        const m = ID_RE.exec(b.pathname);
        if (m) found.push({ id: m[1], url: b.url, at: new Date(b.uploadedAt).getTime() });
      }
      if (!r.hasMore) break;
      cursor = r.cursor;
    }
    found.sort((a, b) => b.at - a.at);
    const items = await Promise.all(
      found.slice(0, 60).map(async (f) => {
        try {
          const c = await (await fetch(f.url, { cache: "no-store" })).json();
          return {
            id: f.id,
            name: String(c.name || ""),
            symbol: String(c.symbol || ""),
            description: String(c.description || ""),
            base: String(c.base || ""),
          };
        } catch {
          return null;
        }
      })
    );
    return NextResponse.json({ items: items.filter(Boolean) });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
