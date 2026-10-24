import { createHash } from "crypto";
import { list } from "@vercel/blob";
import { PNG } from "pngjs";
import { BG, TINT, Config } from "./traits";

export { BG, TINT } from "./traits";
export type { Config } from "./traits";

const RPC = "https://testnet.rialo.io:4101";

export async function getConfig(id: string): Promise<Config | null> {
  const { blobs } = await list({ prefix: `col/${id}/config.json`, limit: 1 });
  if (!blobs.length) return null;
  return await (await fetch(blobs[0].url, { cache: "no-store" })).json();
}

// baca jumlah mint dan supply dari akun collection di chain
export async function chainState(col: string): Promise<{ minted: number; max: number } | null> {
  try {
    const r = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [col, { encoding: "base64" }] }),
      cache: "no-store",
    });
    const j = await r.json();
    const d = j?.result?.value?.data?.[0] ?? j?.result?.data?.[0];
    if (typeof d !== "string") return null;
    const u = Buffer.from(d, "base64");
    if (u.length < 96) return null;
    return { max: Number(u.readBigUInt64LE(72)), minted: Number(u.readBigUInt64LE(80)) };
  } catch {
    return null;
  }
}

// "ok" = sudah di-mint, "hidden" = belum, "oob" = di luar supply, "unchecked" = cek chain gagal (dibuka)
export async function revealState(col: string, n: number) {
  const s = await chainState(col);
  if (!s) return "unchecked";
  if (n > s.max) return "oob";
  return n <= s.minted ? "ok" : "hidden";
}

function rolls(secret: string, col: string, n: number) {
  const h = createHash("sha256").update(`${secret}|${col}|${n}`).digest();
  return [0, 1, 2].map((i) => h.readUInt32BE(i * 4) / 4294967296);
}
function pick(w: number[], r: number) {
  const t = w.reduce((a, b) => a + Math.max(0, b), 0);
  if (t <= 0) return 0;
  let x = r * t;
  for (let i = 0; i < w.length; i++) {
    x -= Math.max(0, w[i]);
    if (x < 0) return i;
  }
  return w.length - 1;
}
export function assign(cfg: Config, secret: string, col: string, n: number) {
  const [r1, r2, r3] = rolls(secret, col, n);
  const bg = pick(cfg.bgW, r1);
  const tint = pick(cfg.tintW, r2);
  const acc = pick([cfg.noneW, ...cfg.acc.map((a) => a.weight)], r3) - 1; // -1 = tanpa aksesori
  return { bg, tint, acc };
}

async function loadPng(url: string): Promise<PNG> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("image fetch failed");
  return PNG.sync.read(Buffer.from(await r.arrayBuffer()));
}
const hex = (c: string) => {
  const v = parseInt(c.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

function over(dst: PNG, src: PNG) {
  for (let i = 0; i < dst.data.length; i += 4) {
    const sa = src.data[i + 3] / 255;
    if (sa === 0) continue;
    for (let k = 0; k < 3; k++) dst.data[i + k] = Math.round(src.data[i + k] * sa + dst.data[i + k] * (1 - sa));
  }
}

export async function compose(cfg: Config, a: { bg: number; tint: number; acc: number }): Promise<Buffer> {
  const base = await loadPng(cfg.base);
  const W = base.width, H = base.height;
  if (W > 2000 || H > 2000) throw new Error("Base image too large (max 2000px)");
  const out = new PNG({ width: W, height: H });
  const c1 = hex(BG[a.bg].c1), c2 = hex(BG[a.bg].c2);
  for (let y = 0; y < H; y++) {
    const t = H > 1 ? y / (H - 1) : 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      for (let k = 0; k < 3; k++) out.data[i + k] = Math.round(c1[k] + (c2[k] - c1[k]) * t);
      out.data[i + 3] = 255;
    }
  }
  const t = TINT[a.tint];
  if (t.gray || t.hue) {
    const g = (t.hue * Math.PI) / 180, c = Math.cos(g), s = Math.sin(g);
    const m = [
      0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
      0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
      0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
    ];
    const d = base.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      if (t.gray) {
        d[i] = d[i + 1] = d[i + 2] = clamp(0.299 * r + 0.587 * gg + 0.114 * b);
      } else {
        d[i] = clamp(m[0] * r + m[1] * gg + m[2] * b);
        d[i + 1] = clamp(m[3] * r + m[4] * gg + m[5] * b);
        d[i + 2] = clamp(m[6] * r + m[7] * gg + m[8] * b);
      }
    }
  }
  over(out, base);
  if (a.acc >= 0) {
    const acc = await loadPng(cfg.acc[a.acc].url);
    if (acc.width === W && acc.height === H) over(out, acc);
  }
  return PNG.sync.write(out);
}
