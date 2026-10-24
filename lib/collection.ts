export const PROGRAM_ID = "F8XyGoC9ypN1n2zJaTLaqKFFLwDupUhgHdmQ9KrFH1hm";
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
