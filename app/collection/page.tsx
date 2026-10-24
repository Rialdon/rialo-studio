"use client";
import { useState } from "react";
import { useRialoWallet } from "../providers";
import { loadCdk } from "../../lib/cdk";
import { EXPLORER, sigOf } from "../../lib/collection";
import { PROGRAM_ID, KELVIN, u64, cat, lstr } from "../../lib/collection";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function LaunchCollection() {
  const { address, isConnected, connect, signAndSend } = useRialoWallet();
  const [name, setName] = useState("My Collection");
  const [symbol, setSymbol] = useState("MCOL");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("0.1");
  const [perWallet, setPerWallet] = useState("0");
  const [supply, setSupply] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [txSig, setTxSig] = useState("");

  const add = (m: string) => setLog((l) => [...l, m]);

  async function launch() {
    setBusy(true);
    setLog([]);
    setError("");
    setLink("");
    setTxSig("");
    try {
      if (!name.trim() || !symbol.trim()) throw new Error("Name and symbol are required.");
      if (new TextEncoder().encode(name.trim()).length > 24) throw new Error("Name max 24 characters.");
      if (new TextEncoder().encode(symbol.trim()).length > 16) throw new Error("Symbol max 16 characters.");
      if (files.length < 1 || files.length > 50) throw new Error("Pick 1 to 50 images.");
      const supplyN = Math.min(100000, parseInt(supply, 10) || files.length);
      const { cdk, client } = await loadCdk();
      const P = (s: string) => cdk.PublicKey.fromString(s);
      const A = (k: any, w: boolean, s = false) => ({ pubkey: k, isSigner: s, isWritable: w });
      const enc = new TextEncoder();
      const sys = typeof cdk.SYSTEM_PROGRAM_ID === "string" ? P(cdk.SYSTEM_PROGRAM_ID) : cdk.SYSTEM_PROGRAM_ID;
      const owner = P(address!);
      const id = BigInt(Date.now());

      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        add(`Uploading image ${i + 1}/${files.length}...`);
        const fd = new FormData();
        fd.append("file", files[i]);
        const r = await fetch("/api/upload", { method: "POST", body: fd });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Upload failed");
        urls.push(j.url);
      }
      const cr = await fetch("/api/collection-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id.toString(), name: name.trim(), symbol: symbol.trim(), description: desc.trim(), images: urls }),
      });
      const cj = await cr.json();
      if (!cr.ok) throw new Error(cj.error || "Config failed");
      const base = `${window.location.origin}/api/meta/${id}/`;
      if (enc.encode(base).length > 128) throw new Error("Base URI too long.");
      add("Base URI: " + base);

      const [col] = cdk.PublicKey.findProgramAddress([enc.encode("col"), owner.toBytes(), u64(id)], P(PROGRAM_ID));
      let lam: any;
      try { lam = await client.getMinimumBalanceForRentExemption(283n); }
      catch { lam = await client.getMinimumBalanceForRentExemption(283); }
      lam = BigInt(lam);
      const priceK = BigInt(Math.round((parseFloat(price) || 0) * KELVIN));
      const perw = BigInt(Math.max(0, parseInt(perWallet, 10) || 0));

      const data = cat(
        new Uint8Array([0]),
        u64(id), u64(priceK), u64(BigInt(supplyN)), u64(perw), u64(lam),
        lstr(name.trim()), lstr(symbol.trim()), lstr(base)
      );
      const tx = cdk.TransactionBuilder.create()
        .setPayer(owner)
        .setValidFrom(BigInt(Date.now()))
        .setConfigHashPrefix(await client.getConfigHashPrefix())
        .addInstruction({ programId: P(PROGRAM_ID), data, accounts: [A(owner, true, true), A(col, true), A(sys, false), A(owner, false)] })
        .build();
      const bytes: Uint8Array = tx.signAll([]).serialize();
      add("Sending to your wallet...");
      setTxSig(sigOf(await signAndSend(bytes)));

      for (let i = 0; i < 12; i++) {
        await sleep(1500);
        try {
          const a = await client.getAccountInfo(col);
          if (a) {
            setLink(`/mint?c=${col.toString()}&t=${address}`);
            add("Collection: " + col.toString());
            return;
          }
        } catch {}
      }
      throw new Error("Collection not found after 18 seconds. The transaction may have failed.");
    } catch (e: any) {
      setError(String(e?.message || e).slice(0, 300));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="screen">
        <h2>Launch collection</h2>
        <p className="sub">Images repeat if supply is higher than the image count. Price and limits are enforced on-chain.</p>

        <div className="two">
          <div className="f"><label>Name</label><input className="in" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="f"><label>Symbol</label><input className="in" value={symbol} onChange={(e) => setSymbol(e.target.value)} /></div>
          <div className="f"><label>Price (RIALO)</label><input className="in" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          <div className="f"><label>Max per wallet (0 = unlimited)</label><input className="in" inputMode="numeric" value={perWallet} onChange={(e) => setPerWallet(e.target.value)} /></div>
        </div>
        <div className="f"><label>Supply (blank = number of images)</label><input className="in" inputMode="numeric" value={supply} onChange={(e) => setSupply(e.target.value)} /></div>
        <div className="f"><label>Description</label><input className="in" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
        <div className="f">
          <label>Images ({files.length} selected)</label>
          <input className="in" type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
        </div>

        {!isConnected ? (
          <button className="btn" onClick={connect}>Connect wallet</button>
        ) : (
          <button className="btn mint" onClick={launch} disabled={busy}>{busy ? "Working..." : "Launch collection"}</button>
        )}
        <p className="fine">Payments go to your wallet. You approve once in your Rialo Wallet.</p>

        {error && <div className="err">{error}</div>}
        {link && (
          <div className="ok">
            Collection created!{txSig && <> (<a href={EXPLORER + "/txs/" + txSig} target="_blank" rel="noreferrer">view tx</a>)</>}<br />
            Mint link: <a href={link}>{link}</a>
          </div>
        )}
        {log.length > 0 && <div className="log">{log.map((l, i) => <div key={i}>{l}</div>)}</div>}
      </div>
    </div>
  );
}
