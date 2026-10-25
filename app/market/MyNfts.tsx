"use client";
import { useEffect, useState } from "react";
import { useRialoWallet } from "../providers";
import { loadCdk } from "../../lib/cdk";
import { b58 } from "../../lib/collection";

type Nft = { mint: string; name: string; image: string };

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export default function MyNfts() {
  const { address, isConnected, connect } = useRialoWallet();
  const [nfts, setNfts] = useState<Nft[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(0);

  async function load() {
    if (!address) return;
    setLoading(true);
    setError("");
    try {
      const { cdk, client } = await loadCdk();
      const mints: string[] = [];
      let after: string | undefined;
      let total = 0;
      for (let page = 0; page < 5; page++) {
        const [accs, pg]: any = await client.getAccountsByOwner(
          cdk.PublicKey.fromString(address), "tokenAccounts", { limit: 100, after });
        for (const it of accs) {
          total++;
          const raw = it.account.data;
          const s = Array.isArray(raw) ? raw[0] : raw;
          if (typeof s !== "string") continue;
          const u = b64(s);
          if (u.length < 72) continue;
          const amount = new DataView(u.buffer).getBigUint64(64, true);
          if (amount !== 1n) continue;
          mints.push(b58(u.slice(0, 32)));
        }
        if (!pg?.hasMore) break;
        after = pg.nextCursor;
      }
      setChecked(total);

      const out: Nft[] = [];
      const list = mints.slice(0, 60);
      for (let i = 0; i < list.length; i += 8) {
        const chunk = list.slice(i, i + 8);
        const got = await Promise.all(
          chunk.map(async (m): Promise<Nft | null> => {
            try {
              const a: any = await client.getAccountInfo(cdk.PublicKey.fromString(m));
              if (!a) return null;
              const u = b64(a.data[0]);
              if (u.length < 82 || u[44] !== 0) return null;
              let str = "";
              for (let k = 0; k < u.length; k++) str += String.fromCharCode(u[k]);
              const hit = /https?:\/\/[\x21-\x7e]+/.exec(str);
              if (!hit) return null;
              const j = await (await fetch(hit[0])).json();
              return { mint: m, name: String(j.name || "NFT"), image: String(j.image || "") };
            } catch { return null; }
          })
        );
        for (const g of got) if (g) out.push(g);
      }
      setNfts(out);
    } catch (e: any) {
      setError(String(e?.message || e).slice(0, 300));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isConnected && address) load();
    else setNfts(null);
  }, [isConnected, address]);

  if (!isConnected) {
    return <button className="btn" onClick={connect}>Connect wallet</button>;
  }

  return (
    <div>
      {error && <div className="err">{error}</div>}
      {loading && <p className="fine">Loading your NFTs...</p>}
      {nfts && nfts.length === 0 && !loading && (
        <p className="fine">No NFTs found ({checked} token accounts checked).</p>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {(nfts || []).map((n) => (
          <div key={n.mint} style={{ border: "3px solid #3b1a45", borderRadius: 16, padding: 8, background: "#fff" }}>
            {n.image ? (
              <img src={n.image} alt="" style={{ width: "100%", borderRadius: 10 }} />
            ) : (
              <div style={{ aspectRatio: "1 / 1", borderRadius: 10, background: "#eadff0" }} />
            )}
            <p style={{ margin: "6px 0 0", fontWeight: 800, fontSize: 13 }}>{n.name}</p>
            <p className="fine" style={{ margin: 0, fontSize: 10 }}>{n.mint.slice(0, 6)}...{n.mint.slice(-4)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
