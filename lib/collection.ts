export const PROGRAM_ID = "3fZWCgKre6hJvdKfUSYLioCrNDTX4dZ963kTPYg9mqMZ";
export const T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const ATAP = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
export const KELVIN = 1_000_000_000;
export const u64 = (n: bigint) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, n, true);
  return b;
};
export const cat = (...a: Uint8Array[]) => {
  const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0));
  let off = 0;
  for (const x of a) { o.set(x, off); off += x.length; }
  return o;
};
export const lstr = (s: string) => {
  const b = new TextEncoder().encode(s);
  return cat(new Uint8Array([b.length]), b);
};

export const EXPLORER = "https://rialo-explorer-testnet-direct.vercel.app";
const A58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function b58(b: Uint8Array) {
  let z = 0;
  while (z < b.length && b[z] === 0) z++;
  const d: number[] = [];
  for (let i = z; i < b.length; i++) {
    let c = b[i];
    for (let j = 0; j < d.length; j++) { c += d[j] << 8; d[j] = c % 58; c = (c / 58) | 0; }
    while (c) { d.push(c % 58); c = (c / 58) | 0; }
  }
  return "1".repeat(z) + d.reverse().map((x) => A58[x]).join("");
}
export function sigOf(res: any): string {
  try {
    const s = Array.isArray(res) ? res[0]?.signature : res?.signature;
    if (typeof s === "string") return s;
    return b58(Uint8Array.from(Object.values(s) as number[]));
  } catch { return ""; }
}
