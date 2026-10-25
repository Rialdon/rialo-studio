"use client";
import { useState } from "react";
import { useRialoWallet } from "../providers";
import { loadCdk } from "../../lib/cdk";
import * as L from "../../lib/collection";
import { BG, TINT } from "../../lib/traits";

const { PROGRAM_ID, KELVIN, u64, cat, lstr } = L;
const sigOf = (L as any).sigOf as ((r: any) => string) | undefined;
const EXPLORER = (L as any).EXPLORER as string | undefined;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pct = (arr: string[], i: number) => {
  const t = arr.reduce((a, b) => a + Math.max(0, parseFloat(b) || 0), 0);
  return t > 0 ? ((Math.max(0, parseFloat(arr[i]) || 0) / t) * 100).toFixed(1) : "0";
};
const nz = (a: string[]) => a.filter((x) => (parseFloat(x) || 0) > 0).length;

const toSec = (v: string) => (v ? Math.floor(new Date(v).getTime() / 1000) : 0);

export default function LaunchCollection() {
  const { address, isConnected, connect, signAndSend } = useRialoWallet();
  const [name, setName] = useState("My Collection");
  const [symbol, setSymbol] = useState("MCOL");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("0.1");
  const [perWallet, setPerWallet] = useState("0");
  const [supply, setSupply] = useState("100");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [base, setBase] = useState<File | null>(null);
  const [bgW, setBgW] = useState<string[]>(BG.map((b) => String(b.weight)));
  const [tintW, setTintW] = useState<string[]>(TINT.map((t) => String(t.weight)));
  const [accCat, setAccCat] = useState("Hat");
  const [accFiles, setAccFiles] = useState<File[]>([]);
  const [accW, setAccW] = useState<string[]>([]);
  const [noneW, setNoneW] = useState("50");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [txSig, setTxSig] = useState("");

  const add = (m: string) => setLog((l) => [...l, m]);
  const supplyN = Math.min(100000, parseInt(supply, 10) || 0);
  const accOpts = accW.filter((w) => (parseFloat(w) || 0) > 0).length + ((parseFloat(noneW) || 0) > 0 ? 1 : 0);
  const combos = nz(bgW) * nz(tintW) * Math.max(1, accOpts);

  async function up(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Upload failed");
    return j.url as string;
  }

  async function launch() {
    setBusy(true);
    setLog([]);
    setError("");
    setLink("");
    setTxSig("");
    try {
      const enc = new TextEncoder();
      if (!name.trim() || !symbol.trim()) throw new Error("Name and symbol are required.");
      if (enc.encode(name.trim()).length > 24) throw new Error("Name max 24 characters.");
      if (enc.encode(symbol.trim()).length > 16) throw new Error("Symbol max 16 characters.");
      if (supplyN < 1) throw new Error("Supply must be at least 1.");
      if (toSec(endAt) && toSec(endAt) <= Math.floor(Date.now() / 1000)) throw new Error("End time must be in the future.");
      if (toSec(startAt) && toSec(endAt) && toSec(endAt) <= toSec(startAt)) throw new Error("End must be after start.");
      if (!base) throw new Error("Pick the base image (PNG).");
      if (base.type !== "image/png" || accFiles.some((f) => f.type !== "image/png")) throw new Error("All images must be PNG.");

      const { cdk, client } = await loadCdk();
      const P = (s: string) => cdk.PublicKey.fromString(s);
      const A = (k: any, w: boolean, s = false) => ({ pubkey: k, isSigner: s, isWritable: w });
      const sys = typeof cdk.SYSTEM_PROGRAM_ID === "string" ? P(cdk.SYSTEM_PROGRAM_ID) : cdk.SYSTEM_PROGRAM_ID;
      const owner = P(address!);
      const id = BigInt(Date.now());
      const [col] = cdk.PublicKey.findProgramAddress([enc.encode("col"), owner.toBytes(), u64(id)], P(PROGRAM_ID));
      const colS = col.toString();

      add("Uploading base image...");
      const baseUrl = await up(base);
      const acc: { name: string; url: string; weight: number }[] = [];
      for (let i = 0; i < accFiles.length; i++) {
        add(`Uploading ${accCat} ${i + 1}/${accFiles.length}...`);
        acc.push({ name: accFiles[i].name.replace(/\.[^.]+$/, "").slice(0, 32), url: await up(accFiles[i]), weight: parseFloat(accW[i]) || 0 });
      }
      const cr = await fetch("/api/collection-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: colS, name: name.trim(), symbol: symbol.trim(), description: desc.trim(), base: baseUrl,
          bgW: bgW.map((x) => parseFloat(x) || 0), tintW: tintW.map((x) => parseFloat(x) || 0),
          accCat: accCat.trim() || "Accessory", acc, noneW: parseFloat(noneW) || 0,
        }),
      });
      const cj = await cr.json();
      if (!cr.ok) throw new Error(cj.error || "Config failed");

      const baseUri = `${window.location.origin}/api/meta/${colS}/`;
      if (enc.encode(baseUri).length > 128) throw new Error("Base URI too long.");
      add("Base URI: " + baseUri);

      let lam: any;
      try { lam = await client.getMinimumBalanceForRentExemption(299n); }
      catch { lam = await client.getMinimumBalanceForRentExemption(299); }
      lam = BigInt(lam);
      const priceK = BigInt(Math.round((parseFloat(price) || 0) * KELVIN));
      const perw = BigInt(Math.max(0, parseInt(perWallet, 10) || 0));
      const data = cat(
        new Uint8Array([0]),
        u64(id), u64(priceK), u64(BigInt(supplyN)), u64(perw), u64(lam), u64(BigInt(toSec(endAt))), u64(BigInt(toSec(startAt))),
        lstr(name.trim()), lstr(symbol.trim()), lstr(baseUri)
      );
      const tx = cdk.TransactionBuilder.create()
        .setPayer(owner)
        .setValidFrom(BigInt(Date.now()))
        .setConfigHashPrefix(await client.getConfigHashPrefix())
        .addInstruction({ programId: P(PROGRAM_ID), data, accounts: [A(owner, true, true), A(col, true), A(sys, false), A(owner, false)] })
        .build();
      const bytes: Uint8Array = tx.signAll([]).serialize();
      add("Sending to your wallet...");
      const res = await signAndSend(bytes);
      if (sigOf) setTxSig(sigOf(res));

      for (let i = 0; i < 12; i++) {
        await sleep(1500);
        try {
          const a = await client.getAccountInfo(col);
          if (a) {
            setLink(`/mint?c=${colS}&t=${address}`);
            add("Collection: " + colS);
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
        <p className="sub">Generative NFTs with rarity. Traits stay hidden until each NFT is minted.</p>

        <div className="two">
          <div className="f"><label>Name</label><input className="in" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="f"><label>Symbol</label><input className="in" value={symbol} onChange={(e) => setSymbol(e.target.value)} /></div>
          <div className="f"><label>Price (RIALO)</label><input className="in" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          <div className="f"><label>Supply</label><input className="in" inputMode="numeric" value={supply} onChange={(e) => setSupply(e.target.value)} /></div>
          <div className="f"><label>Max per wallet (0 = unlimited)</label><input className="in" inputMode="numeric" value={perWallet} onChange={(e) => setPerWallet(e.target.value)} /></div>
        </div>
        <div className="two">
          <div className="f"><label>Start (optional)</label><input className="in" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} /></div>
          <div className="f"><label>End (optional)</label><input className="in" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} /></div>
        </div>
        <div className="f"><label>Description</label><input className="in" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>

        <div className="f">
          <label>Base image (PNG, transparent)</label>
          <input className="in" type="file" accept="image/png" onChange={(e) => setBase(e.target.files?.[0] || null)} />
        </div>

        <p className="sub">Background rarity (weight)</p>
        <div className="two">
          {BG.map((b, i) => (
            <div className="f" key={b.name}>
              <label>{b.name} ({pct(bgW, i)}%)</label>
              <input className="in" inputMode="decimal" value={bgW[i]} onChange={(e) => setBgW(bgW.map((v, j) => (j === i ? e.target.value : v)))} />
            </div>
          ))}
        </div>

        <p className="sub">Color rarity (weight)</p>
        <div className="two">
          {TINT.map((t, i) => (
            <div className="f" key={t.name}>
              <label>{t.name} ({pct(tintW, i)}%)</label>
              <input className="in" inputMode="decimal" value={tintW[i]} onChange={(e) => setTintW(tintW.map((v, j) => (j === i ? e.target.value : v)))} />
            </div>
          ))}
        </div>

        <p className="sub">Optional accessories (PNG, same size as base)</p>
        <div className="f"><label>Category name</label><input className="in" value={accCat} onChange={(e) => setAccCat(e.target.value)} /></div>
        <div className="f">
          <label>{accCat || "Accessory"} images ({accFiles.length} selected)</label>
          <input
            className="in" type="file" accept="image/png" multiple
            onChange={(e) => {
              const fl = Array.from(e.target.files || []).slice(0, 50);
              setAccFiles(fl);
              setAccW(fl.map(() => "10"));
            }}
          />
        </div>
        <div className="two">
          {accFiles.map((f, i) => (
            <div className="f" key={f.name + i}>
              <label>{f.name.replace(/\.[^.]+$/, "")} ({pct([...accW, noneW].slice(0, accW.length).concat([noneW]), i)}%)</label>
              <input className="in" inputMode="decimal" value={accW[i]} onChange={(e) => setAccW(accW.map((v, j) => (j === i ? e.target.value : v)))} />
            </div>
          ))}
          <div className="f">
            <label>No {accCat || "accessory"} ({pct([...accW, noneW], accW.length)}%)</label>
            <input className="in" inputMode="decimal" value={noneW} onChange={(e) => setNoneW(e.target.value)} />
          </div>
        </div>

        <p className="fine">
          {combos.toLocaleString()} possible combinations
          {supplyN > combos ? ". Supply is higher than that, so duplicates will happen." : "."}
        </p>

        {!isConnected ? (
          <button className="btn" onClick={connect}>Connect wallet</button>
        ) : (
          <button className="btn mint" onClick={launch} disabled={busy}>{busy ? "Working..." : "Launch collection"}</button>
        )}
        <p className="fine">Launch from the production site (rialo-studio.vercel.app). Payments go to your wallet.</p>

        {error && <div className="err">{error}</div>}
        {link && (
          <div className="ok">
            Collection created!
            {txSig && EXPLORER && <> (<a href={EXPLORER + "/txs/" + txSig} target="_blank" rel="noreferrer">view tx</a>)</>}
            <br />
            Mint link: <a href={link}>{link}</a>
          </div>
        )}
        {log.length > 0 && <div className="log">{log.map((l, i) => <div key={i}>{l}</div>)}</div>}
      </div>
    </div>
  );
}
