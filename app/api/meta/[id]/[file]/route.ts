import { NextResponse } from "next/server";
import { BG, TINT, getConfig, assign, revealState } from "../../../../../lib/gen";

export async function GET(req: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await params;
  const n = parseInt(file.replace(/\.json$/, ""), 10);
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(id) || !Number.isInteger(n) || n < 1) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const secret = process.env.RARITY_SECRET;
  if (!secret) return NextResponse.json({ error: "server not configured" }, { status: 500 });
  const cfg = await getConfig(id);
  if (!cfg) return NextResponse.json({ error: "not found" }, { status: 404 });
  const state = await revealState(id, n);
  if (state === "oob") return NextResponse.json({ error: "not found" }, { status: 404 });

  const cors = { "Access-Control-Allow-Origin": "*", "X-Reveal": state };
  const name = `${cfg.name} #${n}`;
  if (state === "hidden") {
    return NextResponse.json(
      { name, symbol: cfg.symbol, description: cfg.description, image: cfg.base, attributes: [] },
      { headers: { ...cors, "Cache-Control": "no-store" } }
    );
  }
  const a = assign(cfg, secret, id, n);
  const origin = new URL(req.url).origin;
  return NextResponse.json(
    {
      name,
      symbol: cfg.symbol,
      description: cfg.description,
      image: `${origin}/api/img/${id}/${n}.png`,
      attributes: [
        { trait_type: "Background", value: BG[a.bg].name },
        { trait_type: "Color", value: TINT[a.tint].name },
        { trait_type: cfg.accCat, value: a.acc >= 0 ? cfg.acc[a.acc].name : "None" },
      ],
    },
    { headers: { ...cors, "Cache-Control": "public, max-age=3600" } }
  );
}
