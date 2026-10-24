import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { BG, TINT } from "../../../lib/traits";

export async function POST(req: Request) {
  try {
    const m = await req.json();
    const id = String(m.id || "");
    const num = (x: any) => Math.max(0, Math.min(1e6, Number(x) || 0));
    const okUrl = (u: any) => typeof u === "string" && /^https:\/\//.test(u);
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
    if (!okUrl(m.base) || !Array.isArray(m.bgW) || m.bgW.length !== BG.length || !Array.isArray(m.tintW) || m.tintW.length !== TINT.length) {
      return NextResponse.json({ error: "Bad config" }, { status: 400 });
    }
    const acc = (Array.isArray(m.acc) ? m.acc : [])
      .slice(0, 50)
      .filter((a: any) => okUrl(a?.url))
      .map((a: any) => ({ name: String(a.name || "").slice(0, 32), url: a.url, weight: num(a.weight) }));
    const cfg = {
      name: String(m.name || "").slice(0, 32),
      symbol: String(m.symbol || "").slice(0, 16),
      description: String(m.description || "").slice(0, 500),
      base: m.base,
      bgW: m.bgW.map(num),
      tintW: m.tintW.map(num),
      accCat: String(m.accCat || "Accessory").slice(0, 24),
      acc,
      noneW: num(m.noneW),
    };
    if (cfg.bgW.every((w: number) => w === 0) || cfg.tintW.every((w: number) => w === 0)) {
      return NextResponse.json({ error: "Weights cannot all be zero" }, { status: 400 });
    }
    // tidak boleh menimpa: konfigurasi collection bersifat tetap setelah dibuat
    await put(`col/${id}/config.json`, JSON.stringify(cfg), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "application/json",
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
