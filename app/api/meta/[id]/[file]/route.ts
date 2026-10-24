import { list } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await params;
  const n = parseInt(file.replace(/\.json$/, ""), 10);
  if (!/^\d{1,20}$/.test(id) || !Number.isInteger(n) || n < 1) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const { blobs } = await list({ prefix: `col/${id}/config.json`, limit: 1 });
  if (!blobs.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  const cfg = await (await fetch(blobs[0].url, { cache: "no-store" })).json();
  const imgs: string[] = cfg.images || [];
  return NextResponse.json(
    {
      name: `${cfg.name} #${n}`,
      symbol: cfg.symbol,
      description: cfg.description,
      image: imgs[(n - 1) % imgs.length],
    },
    { headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" } }
  );
}
