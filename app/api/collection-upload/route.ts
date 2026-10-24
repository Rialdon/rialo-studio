import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "Image must be under 4 MB" }, { status: 400 });
    const id = String(form.get("id") || "").replace(/\D/g, "").slice(0, 20);
    const idx = Number(form.get("index"));
    if (!id || !Number.isInteger(idx) || idx < 1 || idx > 500) return NextResponse.json({ error: "Bad id/index" }, { status: 400 });
    const safe = file.name.replace(/[^a-zA-Z0-9.]/g, "_").slice(-40);
    const img = await put(`col/${id}/img-${idx}-${safe}`, file, { access: "public", addRandomSuffix: true });
    const body = JSON.stringify({
      name: String(form.get("name") || "").slice(0, 64),
      symbol: String(form.get("symbol") || "").slice(0, 16),
      description: String(form.get("description") || "").slice(0, 500),
      image: img.url,
    });
    const meta = await put(`col/${id}/${idx}.json`, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return NextResponse.json({ url: meta.url });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
