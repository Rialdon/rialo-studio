import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const m = await req.json();
    const image = String(m.image || "");
    if (!/^https:\/\//.test(image)) return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
    const body = JSON.stringify({
      name: String(m.name || "").slice(0, 64),
      symbol: String(m.symbol || "").slice(0, 16),
      description: String(m.description || "").slice(0, 500),
      image,
    });
    const blob = await put("nft/meta.json", body, {
      access: "public",
      addRandomSuffix: true,
      contentType: "application/json",
    });
    return NextResponse.json({ url: blob.url });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
