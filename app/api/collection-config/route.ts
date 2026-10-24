import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const m = await req.json();
    const id = String(m.id || "").replace(/\D/g, "").slice(0, 20);
    const images: string[] = Array.isArray(m.images) ? m.images.map(String) : [];
    if (!id || images.length < 1 || images.length > 50 || images.some((u) => !/^https:\/\//.test(u))) {
      return NextResponse.json({ error: "Bad config" }, { status: 400 });
    }
    const body = JSON.stringify({
      name: String(m.name || "").slice(0, 64),
      symbol: String(m.symbol || "").slice(0, 16),
      description: String(m.description || "").slice(0, 500),
      images,
    });
    await put(`col/${id}/config.json`, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
