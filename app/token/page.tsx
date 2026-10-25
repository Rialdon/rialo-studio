"use client";
import { useEffect, useState } from "react";
import { useRialoWallet } from "../providers";
import { loadCdk } from "../../lib/cdk";
import { EXPLORER, sigOf, b58 } from "../../lib/collection";

const T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const ATAP = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const DISC = [234, 133, 58, 3, 195, 194, 243, 254]; // initialize metadata Token-2022 versi Rialo
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const replacer = (_k: string, v: any) => (typeof v === "bigint" ? v.toString() : v);

// "1234.5" + 6 desimal -> 1234500000n (tanpa pembulatan float)
function toUnits(s: string, dec: number): bigint {
  const t = s.trim();
  if (!/^[0-9]*\.?[0-9]*$/.test(t) || t === "" || t === ".") return 0n;
  const [w, f = ""] = t.split(".");
  return BigInt(w || "0") * 10n ** BigInt(dec) + BigInt((f + "0".repeat(dec)).slice(0, dec) || "0");
}
const fmt = (v: bigint, d: number) => {
  const s = v.toString().padStart(d + 1, "0");
  const w = s.slice(0, s.length - d);
  const f = d ? s.slice(s.length - d).replace(/0+$/, "") : "";
  return f ? w + "." + f : w;
};

export default function CreateToken() {
  const { address, isConnected, connect, signAndSend } = useRialoWallet();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [decimals, setDecimals] = useState("");
  const [supply, setSupply] = useState("");
  const [lock, setLock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [mintAddr, setMintAddr] = useState("");
  const [txSig, setTxSig] = useState("");
  const [mmMint, setMmMint] = useState("");
  const [mmAmt, setMmAmt] = useState("");
  const [mmInfo, setMmInfo] = useState<any>(null);
  const [mmBusy, setMmBusy] = useState(false);
  const [mmMsg, setMmMsg] = useState("");
  const [mmErr, setMmErr] = useState("");

  const add = (m: string) => setLog((l) => [...l, m]);

  async function mmLoad(m: string) {
    setMmInfo(null);
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(m)) return;
    try {
      const { cdk, client } = await loadCdk();
      const a: any = await client.getAccountInfo(cdk.PublicKey.fromString(m));
      if (!a) { setMmErr("Mint not found."); return; }
      const u = Uint8Array.from(atob(a.data[0]), (c) => c.charCodeAt(0));
      if (u.length < 82) { setMmErr("This is not a token mint."); return; }
      const dv = new DataView(u.buffer);
      setMmInfo({
        dec: u[44],
        supply: dv.getBigUint64(36, true),
        auth: dv.getUint32(0, true) === 1 ? b58(u.slice(4, 36)) : "",
      });
    } catch (e: any) {
      setMmErr(String(e?.message || e).slice(0, 200));
    }
  }

  useEffect(() => { if (mintAddr) setMmMint(mintAddr); }, [mintAddr]);
  useEffect(() => { setMmErr(""); setMmMsg(""); mmLoad(mmMint.trim()); }, [mmMint]);

  async function mintMore() {
    setMmBusy(true);
    setMmErr("");
    setMmMsg("");
    try {
      if (!mmInfo) throw new Error("Enter a valid mint address.");
      if (!mmInfo.auth) throw new Error("Supply is locked, no more minting is possible.");
      if (mmInfo.auth !== address) throw new Error("Only the wallet that created this token can mint more.");
      const units = toUnits(mmAmt, mmInfo.dec);
      if (units <= 0n) throw new Error("Enter an amount greater than 0.");
      const { cdk, client } = await loadCdk();
      const P = (s: string) => cdk.PublicKey.fromString(s);
      const A = (k: any, w: boolean, s = false) => ({ pubkey: k, isSigner: s, isWritable: w });
      const sys = typeof cdk.SYSTEM_PROGRAM_ID === "string" ? P(cdk.SYSTEM_PROGRAM_ID) : cdk.SYSTEM_PROGRAM_ID;
      const owner = P(address!);
      const mintK = P(mmMint.trim());
      const [ata] = cdk.PublicKey.findProgramAddress([owner.toBytes(), P(T22).toBytes(), mintK.toBytes()], P(ATAP));
      const mintTo = new Uint8Array(9); mintTo[0] = 7;
      new DataView(mintTo.buffer).setBigUint64(1, units, true);
      const tx = cdk.TransactionBuilder.create()
        .setPayer(owner)
        .setValidFrom(BigInt(Date.now()))
        .setConfigHashPrefix(await client.getConfigHashPrefix())
        .addInstruction({ programId: P(ATAP), data: new Uint8Array([1]), accounts: [A(owner, true, true), A(ata, true), A(owner, false), A(mintK, false), A(sys, false), A(P(T22), false)] })
        .addInstruction({ programId: P(T22), data: mintTo, accounts: [A(mintK, true), A(ata, true), A(owner, false, true)] })
        .build();
      const before: bigint = mmInfo.supply;
      await signAndSend(tx.signAll([]).serialize());
      for (let i = 0; i < 12; i++) {
        await sleep(1500);
        try {
          const a: any = await client.getAccountInfo(mintK);
          if (a) {
            const u = Uint8Array.from(atob(a.data[0]), (c) => c.charCodeAt(0));
            if (new DataView(u.buffer).getBigUint64(36, true) > before) {
              setMmMsg("Minted " + mmAmt.trim() + " more tokens.");
              setMmAmt("");
              await mmLoad(mmMint.trim());
              return;
            }
          }
        } catch {}
      }
      throw new Error("Supply did not change after 18 seconds. The transaction may have failed.");
    } catch (e: any) {
      setMmErr(String(e?.message || e).slice(0, 300));
    } finally {
      setMmBusy(false);
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
      if (!(parseFloat(supply) > 0)) throw new Error("Enter a supply greater than 0.");
      const { cdk, client } = await loadCdk();
      const P = (s: string) => cdk.PublicKey.fromString(s);
      const A = (k: any, w: boolean, s = false) => ({ pubkey: k, isSigner: s, isWritable: w });
      const enc = new TextEncoder();
      const sys = typeof cdk.SYSTEM_PROGRAM_ID === "string" ? P(cdk.SYSTEM_PROGRAM_ID) : cdk.SYSTEM_PROGRAM_ID;
      const owner = P(address!);
      const mint = cdk.Keypair.generate();
      const dec = decimals.trim() === "" ? 6 : Math.max(0, Math.min(9, parseInt(decimals, 10) || 0));
      const units = BigInt(Math.round((parseFloat(supply) || 0) * 10 ** dec));
      add(`New mint: ${mint.publicKey.toString()}`);

      let rent: any;
      try { rent = await client.getMinimumBalanceForRentExemption(450n); }
      catch { rent = await client.getMinimumBalanceForRentExemption(450); }
      rent = BigInt(rent);

      const [tombstone] = cdk.PublicKey.findProgramAddress([enc.encode("mint_tombstone"), mint.publicKey.toBytes()], P(T22));
      const [ata] = cdk.PublicKey.findProgramAddress([owner.toBytes(), P(T22).toBytes(), mint.publicKey.toBytes()], P(ATAP));

      const ptr = new Uint8Array(66); ptr[0] = 39; ptr[1] = 0;
      ptr.set(owner.toBytes(), 2); ptr.set(mint.publicKey.toBytes(), 34);

      const initMintData = new Uint8Array(35); initMintData[0] = 20; initMintData[1] = dec;
      initMintData.set(owner.toBytes(), 2); initMintData[34] = 0;

      const str = (s: string) => {
        const b = enc.encode(s);
        const o = new Uint8Array(4 + b.length);
        new DataView(o.buffer).setUint32(0, b.length, true);
        o.set(b, 4);
        return o;
      };
      const parts = [Uint8Array.from(DISC), str(name.trim()), str(symbol.trim()), str("")];
      const md = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
      let off = 0;
      for (const p of parts) { md.set(p, off); off += p.length; }

      const mintTo = new Uint8Array(9); mintTo[0] = 7;
      new DataView(mintTo.buffer).setBigUint64(1, units, true);

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
      if (lock) {
        b = b.addInstruction({ programId: P(T22), data: new Uint8Array([6, 0, 0]), accounts: [A(mint.publicKey, true), A(owner, false, true)] });
      }
      const tx = b.build();

      // tanda tangan sebagian: kunci mint (browser) dulu, wallet menyusul lewat ekstensi
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
        <h2>Create token</h2>
        <p className="sub">Makes a Token-2022 token with a name and symbol.</p>

        <div className="two">
          <div className="f"><label>Name</label><input className="in" placeholder="Candy Coin" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="f"><label>Symbol</label><input className="in" placeholder="CANDY" value={symbol} onChange={(e) => setSymbol(e.target.value)} /></div>
          <div className="f"><label>Decimals</label><input className="in" inputMode="numeric" placeholder="6" value={decimals} onChange={(e) => setDecimals(e.target.value)} /></div>
          <div className="f"><label>Supply</label><input className="in" inputMode="decimal" placeholder="1000000" value={supply} onChange={(e) => setSupply(e.target.value)} /></div>
        </div>

        <div className="toggle" onClick={() => setLock((v) => !v)}>
          <span>Lock supply (no more minting)</span>
          <span className={"sw" + (lock ? " on" : "")}><i /></span>
        </div>

        <div className="prev">
          <div className="ico">{(symbol || "?").slice(0, 1).toUpperCase()}</div>
          <div>
            <b style={{ fontSize: 15 }}>{name || "Token name"}</b>
            <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7 }}>{supply || "0"} {symbol.toUpperCase()} · {decimals || "6"} decimals</div>
          </div>
        </div>

        {!isConnected ? (
          <button className="btn" onClick={connect}>Connect wallet</button>
        ) : (
          <button className="btn mint" onClick={create} disabled={busy}>{busy ? "Working..." : "Create token"}</button>
        )}
        <p className="fine">You approve once in your Rialo Wallet. Network fees apply.</p>

        {error && <div className="err">{error}</div>}
        {mintAddr && (
          <div className="ok">
            Token created!<br />Mint: {mintAddr}{txSig && <><br /><a href={EXPLORER + "/txs/" + txSig} target="_blank" rel="noreferrer">View transaction</a></>}
          </div>
        )}
        {log.length > 0 && <div className="log">{log.map((l, i) => <div key={i}>{l}</div>)}</div>}

        <hr style={{ border: 0, borderTop: "3px dashed #3b1a45", opacity: 0.25, margin: "22px 0" }} />
        <h2 style={{ fontSize: 20 }}>Mint more</h2>
        <p className="sub">Add supply to a token you created. Only works if you did not lock the supply.</p>
        <div className="f"><label>Token mint address</label><input className="in" placeholder="Paste mint address" value={mmMint} onChange={(e) => setMmMint(e.target.value)} /></div>
        {mmInfo && (
          <p className="fine">
            Supply: {fmt(mmInfo.supply, mmInfo.dec)} · {mmInfo.dec} decimals ·{" "}
            {!mmInfo.auth ? "Supply locked" : mmInfo.auth === address ? "You can mint more" : "Not your token"}
          </p>
        )}
        <div className="f"><label>Amount to add</label><input className="in" inputMode="decimal" placeholder="500000" value={mmAmt} onChange={(e) => setMmAmt(e.target.value)} /></div>
        {!isConnected ? (
          <button className="btn" onClick={connect}>Connect wallet</button>
        ) : (
          <button className="btn mint" onClick={mintMore} disabled={mmBusy || !mmInfo || !mmInfo.auth || mmInfo.auth !== address}>
            {mmBusy ? "Working..." : "Mint more"}
          </button>
        )}
        {mmErr && <div className="err">{mmErr}</div>}
        {mmMsg && <div className="ok">{mmMsg}</div>}
      </div>
    </div>
  );
}
