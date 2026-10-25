"use client";
import { useEffect, useState, CSSProperties } from "react";
import { useRialoWallet } from "../providers";
import { loadCdk } from "../../lib/cdk";
import { EXPLORER, sigOf } from "../../lib/collection";
import { PROGRAM_ID, T22, ATAP, KELVIN, u64, cat } from "../../lib/collection";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const stepBtn: CSSProperties = {
  width: 48, height: 48, borderRadius: 14, border: "3px solid #3b1a45",
  background: "#ffd84a", fontSize: 24, fontWeight: 900, color: "#3b1a45", cursor: "pointer",
};
const inputStyle: CSSProperties = {
  width: 90, height: 48, borderRadius: 14, border: "3px solid #3b1a45",
  textAlign: "center", fontSize: 22, fontWeight: 900, color: "#3b1a45", background: "#fff",
};

type Result = { mint: string; sig: string; img: string };

// jumlah mint per transaksi (naikkan kalau tes lolos, turunkan kalau error)
const MAX_PER_TX = 3;

export default function MintPage() {
  const { address, isConnected, connect, signAndSendMany } = useRialoWallet();
  const [col, setCol] = useState("");
  const [treasury, setTreasury] = useState("");
  const [info, setInfo] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [qty, setQty] = useState("1");
  const [mine, setMine] = useState(0);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [showModal, setShowModal] = useState(false);

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

  // how many this wallet already minted (from its "rec" account)
  useEffect(() => {
    if (!col || !address || !isConnected) { setMine(0); return; }
    (async () => {
      try {
        const { cdk, client } = await loadCdk();
        const P = (s: string) => cdk.PublicKey.fromString(s);
        const enc = new TextEncoder();
        const [rec] = cdk.PublicKey.findProgramAddress(
          [enc.encode("rec"), P(col).toBytes(), P(address).toBytes()], P(PROGRAM_ID));
        const a: any = await client.getAccountInfo(rec);
        if (!a) { setMine(0); return; }
        const u = Uint8Array.from(atob(a.data[0]), (c) => c.charCodeAt(0));
        setMine(Number(new DataView(u.buffer).getBigUint64(0, true)));
      } catch { setMine(0); }
    })();
  }, [col, address, isConnected, info]);

  const soldOut = info && info.minted >= info.max;
  const remaining = info ? Number(info.max - info.minted) : 0;
  const perw = info ? Number(info.perw) : 0;
  const limited = perw > 0;
  const allowed = info ? Math.max(0, limited ? Math.min(perw - mine, remaining) : remaining) : 0;
  const qtyNum = Math.min(Math.max(parseInt(qty) || 0, 0), allowed);

  useEffect(() => {
    if (allowed > 0 && (parseInt(qty) || 0) > allowed) setQty(String(allowed));
  }, [allowed]);

  async function mint() {
    setBusy(true);
    setLog([]);
    setError("");
    setResults([]);
    setShowModal(false);
    const got: Result[] = [];
    try {
      if (!info) throw new Error("Collection not loaded.");
      if (!treasury) throw new Error("Missing treasury in the link (&t=...).");
      if (info.minted >= info.max) throw new Error("Sold out.");
      if (qtyNum < 1) throw new Error(limited ? "You have reached the max per wallet." : "Enter a valid amount.");

      const { cdk, client } = await loadCdk();
      const P = (s: string) => cdk.PublicKey.fromString(s);
      const A = (k: any, w: boolean, s = false) => ({ pubkey: k, isSigner: s, isWritable: w });
      const enc = new TextEncoder();
      const sys = typeof cdk.SYSTEM_PROGRAM_ID === "string" ? P(cdk.SYSTEM_PROGRAM_ID) : cdk.SYSTEM_PROGRAM_ID;
      const minter = P(address!);
      const colK = P(col);

      const rentOf = async (n: number) => {
        let r: any;
        try { r = await client.getMinimumBalanceForRentExemption(BigInt(n)); }
        catch { r = await client.getMinimumBalanceForRentExemption(n); }
        return BigInt(r);
      };
      const space = 318 + enc.encode(info.name).length + 8 + enc.encode(info.symbol).length + enc.encode(info.uri).length + 10 + 100;
      const mintLam = await rentOf(space);
      const recLam = await rentOf(8);
      const baseIdx = Number(info.minted);

      const kps: any[] = [];
      for (let n = 0; n < qtyNum; n++) kps.push(cdk.Keypair.generate());
      const [rec] = cdk.PublicKey.findProgramAddress([enc.encode("rec"), colK.toBytes(), minter.toBytes()], P(PROGRAM_ID));
      let recExists = false;
      try { recExists = !!(await client.getAccountInfo(rec)); } catch {}

      // bagi ke beberapa transaksi; kalau akun rec belum ada, transaksi pertama hanya 1 mint
      const groups: number[][] = [];
      let idx = 0;
      if (!recExists) { groups.push([0]); idx = 1; }
      while (idx < qtyNum) {
        const g: number[] = [];
        for (let k = 0; k < MAX_PER_TX && idx < qtyNum; k++) g.push(idx++);
        groups.push(g);
      }

      const txs: Uint8Array[] = [];
      for (const g of groups) {
        let bld: any = cdk.TransactionBuilder.create()
          .setPayer(minter)
          .setValidFrom(BigInt(Date.now()))
          .setConfigHashPrefix(await client.getConfigHashPrefix());
        for (const n of g) {
          const nk = kps[n];
          add(`#${n + 1}: new mint ${nk.publicKey.toString()}`);
          const [tomb] = cdk.PublicKey.findProgramAddress([enc.encode("mint_tombstone"), nk.publicKey.toBytes()], P(T22));
          const [ata] = cdk.PublicKey.findProgramAddress([minter.toBytes(), P(T22).toBytes(), nk.publicKey.toBytes()], P(ATAP));
          const data = cat(new Uint8Array([1]), u64(mintLam), u64(recLam));
          bld = bld.addInstruction({
            programId: P(PROGRAM_ID),
            data,
            accounts: [
              A(minter, true, true), A(colK, true), A(P(treasury), true), A(nk.publicKey, true, true),
              A(ata, true), A(rec, true), A(tomb, false), A(P(T22), false), A(P(ATAP), false), A(sys, false),
            ],
          });
        }
        const tx = bld.build();
        txs.push(tx.signAll(g.map((n) => kps[n])).serialize());
      }

      add(`Sending ${qtyNum} mint(s) in ${txs.length} transaction(s)...`);
      const sigs = await signAndSendMany(txs);
      const sigOfNft: any[] = [];
      groups.forEach((g, gi) => g.forEach((n) => { sigOfNft[n] = sigs[gi]; }));

      for (let n = 0; n < qtyNum; n++) {
        setProgress(`${n + 1}/${qtyNum}`);
        const nk = kps[n];
        let found = false;
        for (let i = 0; i < 12; i++) {
          await sleep(1500);
          try {
            const a2 = await client.getAccountInfo(nk.publicKey);
            if (a2) { found = true; break; }
          } catch {}
        }
        if (!found) throw new Error("NFT #" + (n + 1) + " was not found after 18 seconds. The transaction may have failed.");
        let img = "";
        try {
          const mj = await (await fetch(info.uri + (baseIdx + n + 1) + ".json")).json();
          img = mj.image || "";
        } catch {}
        got.push({ mint: nk.publicKey.toString(), sig: sigOf(sigOfNft[n]), img });
        setResults([...got]);
      }
      setShowModal(true);
    } catch (e: any) {
      setError(String(e?.message || e).slice(0, 300));
      if (got.length) setShowModal(true);
    } finally {
      setBusy(false);
      setProgress("");
      load();
    }
  }

  const btnLabel = soldOut
    ? "Sold out"
    : limited && allowed === 0
    ? "Limit reached"
    : busy
    ? `Minting ${progress}...`
    : qtyNum > 1
    ? `Mint ${qtyNum} NFTs`
    : "Mint 1 NFT";

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

        {isConnected && info && !soldOut && allowed > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center" }}>
              <button type="button" style={stepBtn} disabled={busy} onClick={() => setQty(String(Math.max(1, qtyNum - 1)))}>−</button>
              <input
                inputMode="numeric"
                value={qty}
                readOnly={limited}
                disabled={busy}
                onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))}
                onBlur={() => setQty(String(Math.min(Math.max(parseInt(qty) || 1, 1), Math.max(allowed, 1))))}
                style={inputStyle}
              />
              <button type="button" style={stepBtn} disabled={busy} onClick={() => setQty(String(Math.min(allowed, qtyNum + 1)))}>+</button>
              <button type="button" style={{ ...stepBtn, width: 64, fontSize: 16 }} disabled={busy} onClick={() => setQty(String(allowed))}>Max</button>
            </div>
            <p className="fine">
              {limited
                ? `Max ${perw} per wallet · you can mint ${allowed} more`
                : `No wallet limit · type any amount up to ${remaining}`}
            </p>
          </div>
        )}

        {!isConnected ? (
          <button className="btn" onClick={connect}>Connect wallet</button>
        ) : (
          <button className="btn mint" onClick={mint} disabled={busy || !info || soldOut || qtyNum < 1}>
            {btnLabel}
          </button>
        )}
        <p className="fine">Price plus network fees apply. You approve in your Rialo Wallet.</p>

        {error && <div className="err">{error}</div>}
        {log.length > 0 && <div className="log">{log.map((l, i) => <div key={i}>{l}</div>)}</div>}

        {showModal && results.length > 0 && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
            <div style={{ background: "#fff", borderRadius: 20, border: "3px solid #3b1a45", padding: 20, maxWidth: 380, width: "100%", maxHeight: "90vh", overflowY: "auto", textAlign: "center" }}>
              <h3 style={{ margin: "0 0 12px" }}>
                {results.length > 1 ? `Mint Successful! (${results.length} NFTs)` : "Mint Successful!"}
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: results.length > 1 ? "1fr 1fr" : "1fr", gap: 10 }}>
                {results.map((r, i) => (
                  <div key={i}>
                    {r.img ? <img src={r.img} alt="" style={{ width: "100%", borderRadius: 12 }} /> : <p>Loading image...</p>}
                    <p style={{ fontSize: 11, margin: "4px 0 0" }}>
                      <a href={EXPLORER + "/txs/" + r.sig} target="_blank" rel="noreferrer">View transaction</a>
                    </p>
                  </div>
                ))}
              </div>
              <button className="btn" style={{ marginTop: 14 }} onClick={() => setShowModal(false)}>OK</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
