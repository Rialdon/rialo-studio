import { put, list } from "@vercel/blob";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const PATH = /^mk\/([1-9A-HJ-NP-Za-km-z]{32,44})\.json$/;

// Daftar mint yang pernah di-list.
// Status listing aktif dibaca dari blockchain.
export async function POST(req: Request) {
  try {
    const { mint } = await req.json();

    if (!B58.test(String(mint || ""))) {
      return NextResponse.json(
        { error: "Bad mint" },
        { status: 400 },
      );
    }

    await put(
      `mk/${mint}.json`,
      JSON.stringify({ mint, at: Date.now() }),
      {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      },
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const found: { m: string; at: number }[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < 5; page++) {
      const r = await list({
        prefix: "mk/",
        limit: 1000,
        cursor,
      });

      for (const b of r.blobs) {
        const m = PATH.exec(b.pathname);

        if (m) {
          found.push({
            m: m[1],
            at: new Date(b.uploadedAt).getTime(),
          });
        }
      }

      if (!r.hasMore) break;
      cursor = r.cursor;
    }

    found.sort((a, b) => b.at - a.at);

    return NextResponse.json({
      mints: found.slice(0, 100).map((f) => f.m),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 },
    );
  }
}
