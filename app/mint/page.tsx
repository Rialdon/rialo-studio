"use client";
import { useEffect, useState } from "react";
import { useRialoWallet } from "../providers";
import { loadCdk } from "../../lib/cdk";
import { EXPLORER, sigOf } from "../../lib/collection";
import { PROGRAM_ID, T22, ATAP, KELVIN, u64, cat } from "../../lib/collection";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const replacer = (_k: string, v: any) => (typeof v === "bigint" ? v.toString() : v);

export default function MintPage() {
  const { address, isConnected, connect, signAndSend } = useRialoWallet();
  const [col, setCol] = useState("");
  const [treasury, setTreasury] = useState("");
  const [info, setInfo] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [txSig, setTxSig] = useState("");
  const [img, setImg] = useState("");

  const add = (m: string) => setLog((l) => [...l, m]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setCol(q.get("c") || "");
    setTreasury(q.get("t") || "");
  }, []);

  async function load() {
    try {
      setError("");
      const { cdk, client } = await loadCdk();
      const a: any = await client.getAccountInfo(cdk.PublicKey.fromString(col));
      if (!a) throw new Error("Collection not found.");
      const u = Uint8Array.from(atob(a.data[0]), (c) => c.charCodeAt(0));
      const dv = new DataView(u.buffer);
      const str = (o: number) => new TextDecoder().decode(u.slice(o + 1, o + 1 + u[o]));
      setInfo({
        price: dv.getBigUint64(64, true),
        max: dv.getBigUint64(72, true),
        minted: dv.getBigUint64(80, true),
        perw: dv.getBigUint64(88, true),
        name: str(104),
        symbol: str(137),
        uri: str(154),
      });
    } catch (e: any) {
      setError(String(e?.message || e).slice(0, 300));
    }
  }

  useEffect(() => {
    if (col) load();
  }, [col]);

  async function mint() {
    setBusy(true);
    setLog([]);
    setError("");
    setDone("");
    setTxSig("");
    setImg("");
    try {
      if (!info) throw new Error("Collection not loaded.");
      if (!treasury) throw new Error("Missing treasury in the link (&t=...).");
      if (info.minted >= info.max) throw new Error("Sold out.");
      const tokenIdx = Number(info.minted) + 1;
      const { cdk, client } = await loadCdk();
      const P = (s: string) => cdk.PublicKey.fromString(s);
      const A = (k: any, w: boolean, s = false) => ({ pubkey: k, isSigner: s, isWritable: w });
      const enc = new TextEncoder();
      const sys = typeof cdk.SYSTEM_PROGRAM_ID === "string" ? P(cdk.SYSTEM_PROGRAM_ID) : cdk.SYSTEM_PROGRAM_ID;
      const minter = P(address!);
      const colK = P(col);
      const mint = cdk.Keypair.generate();
      add("New mint: " + mint.publicKey.toString());

      const rentOf = async (n: number) => {
        let r: any;
        try { r = await client.getMinimumBalanceForRentExemption(BigInt(n)); }
        catch { r = await client.getMinimumBalanceForRentExemption(n); }
        return BigInt(r);
      };
      const space = 318 + enc.encode(info.name).length + 8 + enc.encode(info.symbol).length + enc.encode(info.uri).length + 10 + 100;
      const mintLam = await rentOf(space);
      const recLam = await rentOf(8);

      const [tomb] = cdk.PublicKey.findProgramAddress([enc.encode("mint_tombstone"), mint.publicKey.toBytes()], P(T22));
      const [ata] = cdk.PublicKey.findProgramAddress([minter.toBytes(), P(T22).toBytes(), mint.publicKey.toBytes()], P(ATAP));
      const [rec] = cdk.PublicKey.findProgramAddress([enc.encode("rec"), colK.toBytes(), minter.toBytes()], P(PROGRAM_ID));

      const data = cat(new Uint8Array([1]), u64(mintLam), u64(recLam));
      const tx = cdk.TransactionBuilder.create()
        .setPayer(minter)
        .setValidFrom(BigInt(Date.now()))
        .setConfigHashPrefix(await client.getConfigHashPrefix())
        .addInstruction({
          programId: P(PROGRAM_ID),
          data,
          accounts: [
            A(minter, true, true), A(colK, true), A(P(treasury), true), A(mint.publicKey, true, true),
            A(ata, true), A(rec, true), A(tomb, false), A(P(T22), false), A(P(ATAP), false), A(sys, false),
          ],
        })
        .build();
      const bytes: Uint8Array = tx.signAll([mint]).serialize();
      add("Sending to your wallet...");
      const res = await signAndSend(bytes);
      setTxSig(sigOf(res));

      for (let i = 0; i < 12; i++) {
        await sleep(1500);
        try {
          const a = await client.getAccountInfo(mint.publicKey);
          if (a) {
            try { const mj = await (await fetch(info.uri + tokenIdx + ".json")).json(); setImg(mj.image || ""); } catch {}
            setDone(mint.publicKey.toString());
            setShowModal(true);
            load();
            return;
          }
        } catch {}
      }
      throw new Error("The NFT was not found after 18 seconds. The transaction may have failed.");
    } catch (e: any) {
      setError(String(e?.message || e).slice(0, 300));
    } finally {
      setBusy(false);
    }
  }

  const soldOut = info && info.minted >= info.max;
  return (
    <div className="page">
      <div className="screen">
        <h2>{info ? info.name : "Mint NFT"}</h2>
        <p className="sub">
          {info
            ? `${info.minted.toString()} / ${info.max.toString()} minted · ${Number(info.price) / KELVIN} RIALO each` +
              (info.perw > 0n ? ` · max ${info.perw.toString()} per wallet` : "")
            : "Loading collection..."}
        </p>

        {info && !soldOut && (
          <div style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: 12, marginBottom: 12, background: "linear-gradient(135deg,#b8a5ff,#ff9ecb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 110, fontWeight: 900, color: "#3b1a45" }}>?</div>
        )}

        {!isConnected ? (
          <button className="btn" onClick={connect}>Connect wallet</button>
        ) : (
          <button className="btn mint" onClick={mint} disabled={busy || !info || soldOut}>
            {soldOut ? "Sold out" : busy ? "Working..." : "Mint 1 NFT"}
          </button>
        )}
        <p className="fine">Price plus network fees apply. You approve once in your Rialo Wallet.</p>

        {error && <div className="err">{error}</div>}
        {done && showModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
            <div style={{ background: "#fff", borderRadius: 20, border: "3px solid #3b1a45", padding: 20, maxWidth: 360, width: "100%", textAlign: "center" }}>
              {img ? <img src={img} alt="" style={{ width: "100%", borderRadius: 12 }} /> : <p>Loading image...</p>}
              <h3 style={{ margin: "14px 0 6px" }}>Mint Successful!</h3>
              <p style={{ fontSize: 12, wordBreak: "break-all", margin: "0 0 8px" }}>Mint: {done}</p>
              {txSig && <p style={{ margin: "0 0 12px" }}><a href={EXPLORER + "/txs/" + txSig} target="_blank" rel="noreferrer">View transaction</a></p>}
              <button className="btn" onClick={() => setShowModal(false)}>OK</button>
            </div>
          </div>
        )}
        {log.length > 0 && <div className="log">{log.map((l, i) => <div key={i}>{l}</div>)}</div>}
      </div>
    </div>
  );
}
