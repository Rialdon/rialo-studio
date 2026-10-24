import { NextResponse } from "next/server";
import { getConfig, assign, compose, revealState } from "../../../../../lib/gen";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  try {
    const { id, file } = await params;
    const n = parseInt(file.replace(/\.png$/, ""), 10);
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(id) || !Number.isInteger(n) || n < 1) {
      return NextResponse.json({ error: "bad request" }, { status: 400 });
    }
    const secret = process.env.RARITY_SECRET;
    if (!secret) return NextResponse.json({ error: "server not configured" }, { status: 500 });
    const cfg = await getConfig(id);
    if (!cfg) return NextResponse.json({ error: "not found" }, { status: 404 });
    const state = await revealState(id, n);
    if (state === "oob" || state === "hidden") return NextResponse.json({ error: "not revealed" }, { status: 404 });
    const png = await compose(cfg, assign(cfg, secret, id, n));
    return new Response(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
