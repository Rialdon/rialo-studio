import { loadCdk } from "./cdk";
import { T22, ATAP, KELVIN, u64, cat, b58 } from "./collection";

export const MARKET_ID = "HsAFfYYuu8XRM7bF7G351SqMxdCgi67NVLoPwW5BmVyF";
const LIST_SIZE = 73;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function ctx() {
  const { cdk, client } = await loadCdk();
  const P = (s: string) => cdk.PublicKey.fromString(s);
  const A = (k: any, w: boolean, s = false) => ({
    pubkey: k,
    isSigner: s,
    isWritable: w,
  });
  const enc = new TextEncoder();
  const sys =
    typeof cdk.SYSTEM_PROGRAM_ID === "string"
      ? P(cdk.SYSTEM_PROGRAM_ID)
      : cdk.SYSTEM_PROGRAM_ID;

  const ataOf = (owner: any, mint: any) =>
    cdk.PublicKey.findProgramAddress(
      [owner.toBytes(), P(T22).toBytes(), mint.toBytes()],
      P(ATAP),
    )[0];

  const listOf = (mint: any) =>
    cdk.PublicKey.findProgramAddress(
      [enc.encode("list"), mint.toBytes()],
      P(MARKET_ID),
    )[0];

  const send = async (
    payer: any,
    accounts: any[],
    data: Uint8Array,
    signAndSend: (b: Uint8Array) => Promise<any>,
  ) => {
    const tx = cdk.TransactionBuilder.create()
      .setPayer(payer)
      .setValidFrom(BigInt(Date.now()))
      .setConfigHashPrefix(await client.getConfigHashPrefix())
      .addInstruction({
        programId: P(MARKET_ID),
        data,
        accounts,
      })
      .build();

    return signAndSend(tx.signAll([]).serialize());
  };

  return { cdk, client, P, A, sys, ataOf, listOf, send };
}

async function rentOf(client: any, n: number): Promise<bigint> {
  let r: any;
  try {
    r = await client.getMinimumBalanceForRentExemption(BigInt(n));
  } catch {
    r = await client.getMinimumBalanceForRentExemption(n);
  }
  return BigInt(r);
}

export async function listNft(
  wallet: string,
  mintS: string,
  price: number,
  signAndSend: any,
) {
  const c = await ctx();
  const mint = c.P(mintS);
  const seller = c.P(wallet);
  const lst = c.listOf(mint);
  const lam = await rentOf(c.client, LIST_SIZE);

  const data = cat(
    new Uint8Array([0]),
    u64(BigInt(Math.round(price * KELVIN))),
    u64(lam),
  );

  return c.send(
    seller,
    [
      c.A(seller, true, true),
      c.A(mint, false),
      c.A(c.ataOf(seller, mint), true),
      c.A(lst, true),
      c.A(c.ataOf(lst, mint), true),
      c.A(c.P(T22), false),
      c.A(c.P(ATAP), false),
      c.A(c.sys, false),
    ],
    data,
    signAndSend,
  );
}

export async function buyNft(
  wallet: string,
  sellerS: string,
  mintS: string,
  signAndSend: any,
) {
  const c = await ctx();
  const mint = c.P(mintS);
  const buyer = c.P(wallet);
  const seller = c.P(sellerS);
  const lst = c.listOf(mint);

  return c.send(
    buyer,
    [
      c.A(buyer, true, true),
      c.A(seller, true),
      c.A(mint, false),
      c.A(lst, true),
      c.A(c.ataOf(lst, mint), true),
      c.A(c.ataOf(buyer, mint), true),
      c.A(c.P(T22), false),
      c.A(c.P(ATAP), false),
      c.A(c.sys, false),
    ],
    new Uint8Array([1]),
    signAndSend,
  );
}

export async function cancelListing(
  wallet: string,
  mintS: string,
  signAndSend: any,
) {
  const c = await ctx();
  const mint = c.P(mintS);
  const seller = c.P(wallet);
  const lst = c.listOf(mint);

  return c.send(
    seller,
    [
      c.A(seller, true, true),
      c.A(mint, false),
      c.A(lst, true),
      c.A(c.ataOf(lst, mint), true),
      c.A(c.ataOf(seller, mint), true),
      c.A(c.P(T22), false),
      c.A(c.P(ATAP), false),
      c.A(c.sys, false),
    ],
    new Uint8Array([2]),
    signAndSend,
  );
}

export async function readListing(
  mintS: string,
): Promise<{ seller: string; price: bigint; active: boolean } | null> {
  try {
    const c = await ctx();
    const a: any = await c.client.getAccountInfo(c.listOf(c.P(mintS)));
    if (!a) return null;

    const u = b64(a.data[0]);
    if (u.length < LIST_SIZE) return null;

    return {
      seller: b58(u.slice(0, 32)),
      price: new DataView(u.buffer).getBigUint64(32, true),
      active: u[72] === 1,
    };
  } catch {
    return null;
  }
}

export async function waitListing(
  mintS: string,
  wantActive: boolean,
) {
  for (let i = 0; i < 14; i++) {
    await sleep(1500);
    const l = await readListing(mintS);

    if (wantActive ? l?.active : l && !l.active) {
      return true;
    }
  }

  return false;
}

export async function nftMeta(
  mintS: string,
): Promise<{ name: string; image: string } | null> {
  try {
    const { cdk, client } = await loadCdk();
    const a: any = await client.getAccountInfo(
      cdk.PublicKey.fromString(mintS),
    );

    if (!a) return null;

    const u = b64(a.data[0]);
    let str = "";

    for (let k = 0; k < u.length; k++) {
      str += String.fromCharCode(u[k]);
    }

    const hit = /https?:\/\/[\x21-\x7e]+/.exec(str);
    if (!hit) return null;

    const j = await (await fetch(hit[0])).json();

    return {
      name: String(j.name || "NFT"),
      image: String(j.image || ""),
    };
  } catch {
    return null;
  }
}
