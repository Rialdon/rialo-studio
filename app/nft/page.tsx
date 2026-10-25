"use client";
import { useState } from "react";
import { useRialoWallet } from "../providers";
import { loadCdk } from "../../lib/cdk";
import { EXPLORER, sigOf } from "../../lib/collection";

const T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const ATAP = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const DISC = [234, 133, 58, 3, 195, 194, 243, 254]; // initialize metadata Token-2022 versi Rialo
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const replacer = (_k: string, v: any) => (typeof v === "bigint" ? v.toString() : v);

export default function CreateNft() {
  const { address, isConnected, connect, signAndSend } = useRialoWallet();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [desc, setDesc] = useState("");
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [mintAddr, setMintAddr] = useState("");
  const [txSig, setTxSig] = useState("");

  const [uploading, setUploading] = useState(false);

  const add = (m: string) => setLog((l) => [...l, m]);

  async function pick(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) return setError("File must be an image.");
    if (file.size > 4 * 1024 * 1024) return setError("Image must be under 4 MB.");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Upload failed");
      setImage(j.url);
    } catch (err: any) {
      setError(String(err?.message || err).slice(0, 300));
    } finally {
      setUploading(false);
    }
  }

  async function create() {
    setBusy(true);
    setLog([]);
    setError("");
    setMintAddr("");
    setTxSig("");
    try {
      if (!name.trim() || !symbol.trim()) throw new Error("Name and symbol are required.");
      if (!/^https?:\/\//.test(image.trim())) throw new Error("Image URL must start with http(s)://");
      const { cdk, client } = await loadCdk();
      const P = (s: string) => cdk.PublicKey.fromString(s);
      const A = (k: any, w: boolean, s = false) => ({ pubkey: k, isSigner: s, isWritable: w });
      const enc = new TextEncoder();
      const sys = typeof cdk.SYSTEM_PROGRAM_ID === "string" ? P(cdk.SYSTEM_PROGRAM_ID) : cdk.SYSTEM_PROGRAM_ID;
      const owner = P(address!);
      const mint = cdk.Keypair.generate();
      add(`New mint: ${mint.publicKey.toString()}`);

      // metadata JSON -> data URI (tanpa hosting)
      const json = JSON.stringify({
        name: name.trim(),
        symbol: symbol.trim(),
        description: desc.trim(),
        image: image.trim(),
      });
      add("Uploading metadata...");
      const mr = await fetch("/api/metadata", { method: "POST", headers: { "Content-Type": "application/json" }, body: json });
      const mj = await mr.json();
      if (!mr.ok) throw new Error(mj.error || "Metadata upload failed");
      const uri: string = mj.url;
      const uriBytes = enc.encode(uri).length;
      if (uriBytes > 700) throw new Error("Metadata too long. Use a shorter description or image URL.");

      // ukuran akun: mint + pointer (234) + metadata, plus margin
      const space =
        318 + enc.encode(name.trim()).length + enc.encode(symbol.trim()).length + uriBytes + 100;
      let rent: any;
      try { rent = await client.getMinimumBalanceForRentExemption(BigInt(space)); }
      catch { rent = await client.getMinimumBalanceForRentExemption(space); }
      rent = BigInt(rent);

      const [tombstone] = cdk.PublicKey.findProgramAddress([enc.encode("mint_tombstone"), mint.publicKey.toBytes()], P(T22));
      const [ata] = cdk.PublicKey.findProgramAddress([owner.toBytes(), P(T22).toBytes(), mint.publicKey.toBytes()], P(ATAP));

      const ptr = new Uint8Array(66); ptr[0] = 39; ptr[1] = 0;
      ptr.set(owner.toBytes(), 2); ptr.set(mint.publicKey.toBytes(), 34);

      const initMintData = new Uint8Array(35); initMintData[0] = 20; initMintData[1] = 0; // decimals 0
      initMintData.set(owner.toBytes(), 2); initMintData[34] = 0;

      const str = (s: string) => {
        const b = enc.encode(s);
        const o = new Uint8Array(4 + b.length);
        new DataView(o.buffer).setUint32(0, b.length, true);
        o.set(b, 4);
        return o;
      };
      const parts = [Uint8Array.from(DISC), str(name.trim()), str(symbol.trim()), str(uri)];
      const md = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
      let off = 0;
      for (const p of parts) { md.set(p, off); off += p.length; }

      const mintTo = new Uint8Array(9); mintTo[0] = 7;
      new DataView(mintTo.buffer).setBigUint64(1, 1n, true); // supply 1

      let b = cdk.TransactionBuilder.create()
        .setPayer(owner)
        .setValidFrom(BigInt(Date.now()))
        .setConfigHashPrefix(await client.getConfigHashPrefix())
        .addInstruction(cdk.createAccount(owner, mint.publicKey, rent, 234n, P(T22)))
        .addInstruction({ programId: P(T22), data: ptr, accounts: [A(mint.publicKey, true)] })
        .addInstruction({ programId: P(T22), data: initMintData, accounts: [A(mint.publicKey, true), A(tombstone, false)] })
        .addInstruction({ programId: P(T22), data: md, accounts: [A(mint.publicKey, true), A(owner, false), A(mint.publicKey, false), A(owner, false, true)] })
        .addInstruction({ programId: P(ATAP), data: new Uint8Array([1]), accounts: [A(owner, true, true), A(ata, true), A(owner, false), A(mint.publicKey, false), A(sys, false), A(P(T22), false)] })
        .addInstruction({ programId: P(T22), data: mintTo, accounts: [A(mint.publicKey, true), A(ata, true), A(owner, false, true)] });
      // supply selalu dikunci: NFT 1-of-1 tidak bisa dicetak lagi
      b = b.addInstruction({ programId: P(T22), data: new Uint8Array([6, 0, 0]), accounts: [A(mint.publicKey, true), A(owner, false, true)] });
      const tx = b.build();

      const partial = tx.signAll([mint]);
      add("Signed with the new mint key");
      const bytes: Uint8Array = partial.serialize();
      add(`Sending to your wallet (${bytes.length} bytes)...`);
      const res = await signAndSend(bytes);
      setTxSig(sigOf(res));

      for (let i = 0; i < 12; i++) {
        await sleep(1500);
        try {
          const a = await client.getAccountInfo(mint.publicKey);
          if (a) {
            setMintAddr(mint.publicKey.toString());
            return;
          }
        } catch {}
      }
      throw new Error("The mint was not found after 18 seconds. The transaction may have failed.");
    } catch (e: any) {
      setError(String(e?.message || e).slice(0, 300));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="screen">
        <h2>Create NFT</h2>
        <p className="sub">Mints one Token-2022 NFT (supply 1, 0 decimals) with on-chain metadata. Supply is always locked.</p>

        <div className="two">
          <div className="f"><label>Name</label><input className="in" placeholder="My First NFT" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="f"><label>Symbol</label><input className="in" placeholder="MNFT" value={symbol} onChange={(e) => setSymbol(e.target.value)} /></div>
        </div>
        <div className="f"><label>Description</label><input className="in" placeholder="Short description" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
        <div className="f"><label>Image</label><input className="in" type="file" accept="image/*" onChange={pick} />{uploading && <small>Uploading...</small>}</div>

        <div className="prev">
          {image ? (
            <img src={image} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover" }} />
          ) : (
            <div className="ico">{(symbol || "?").slice(0, 1).toUpperCase()}</div>
          )}
          <div>
            <b style={{ fontSize: 15 }}>{name || "NFT name"}</b>
            <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7 }}>1 {symbol.toUpperCase()} · 0 decimals</div>
          </div>
        </div>

        {!isConnected ? (
          <button className="btn" onClick={connect}>Connect wallet</button>
        ) : (
          <button className="btn mint" onClick={create} disabled={busy || uploading}>{busy ? "Working..." : "Create NFT"}</button>
        )}
        <p className="fine">You approve once in your Rialo Wallet. Network fees apply.</p>

        {error && <div className="err">{error}</div>}
        {mintAddr && (
          <div className="ok">
            NFT created!<br />Mint: {mintAddr}{txSig && <><br /><a href={EXPLORER + "/txs/" + txSig} target="_blank" rel="noreferrer">View transaction</a></>}
          </div>
        )}
        {log.length > 0 && <div className="log">{log.map((l, i) => <div key={i}>{l}</div>)}</div>}
      </div>
    </div>
  );
}
