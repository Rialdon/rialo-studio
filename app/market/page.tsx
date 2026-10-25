"use client";
import { useEffect, useState, CSSProperties } from "react";
import Link from "next/link";
import { loadCdk } from "../../lib/cdk";
import { b58, KELVIN } from "../../lib/collection";
import MyNfts from "./MyNfts";
import Listings from "./Listings";
import { HIDDEN } from "../../lib/hidden";

type Item = { id: string; name: string; symbol: string; description: string; base: string };
type Live = { price: bigint; max: bigint; minted: bigint; perw: bigint; treasury: string; end: bigint };

const tab = (on: boolean): CSSProperties => ({
  flex: 1, height: 40, borderRadius: 12, border: "3px solid #3b1a45",
  background: on ? "#ffd84a" : "#fff", color: "#3b1a45", fontWeight: 900, cursor: "pointer",
});

export default function MarketPage() {
  const [view, setView] = useState<"col" | "list" | "mine">("list");
  const [items, setItems] = useState<Item[] | null>(null);
  const [live, setLive] = useState<Record<string, Live | null>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/collections", { cache: "no-store" });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed to load collections");
        const list: Item[] = j.items || [];
        setItems(list);
        const { cdk, client } = await loadCdk();
        await Promise.all(
          list.map(async (it) => {
            try {
              const a: any = await client.getAccountInfo(cdk.PublicKey.fromString(it.id));
              if (!a) { setLive((p) => ({ ...p, [it.id]: null })); return; }
              const u = Uint8Array.from(atob(a.data[0]), (c) => c.charCodeAt(0));
              const dv = new DataView(u.buffer);
              const l: Live = {
                price: dv.getBigUint64(64, true),
                max: dv.getBigUint64(72, true),
                minted: dv.getBigUint64(80, true),
                perw: dv.getBigUint64(88, true),
                treasury: b58(u.slice(32, 64)),
                end: u.length >= 299 ? dv.getBigUint64(283, true) : 0n,
              };
              setLive((p) => ({ ...p, [it.id]: l }));
            } catch {
              setLive((p) => ({ ...p, [it.id]: null }));
            }
          })
        );
      } catch (e: any) {
        setError(String(e?.message || e).slice(0, 300));
      }
    })();
  }, []);

  const shown = (items || []).filter((it) => !HIDDEN.includes(it.id)).filter((it) => { const l = live[it.id]; return l !== null && !(l && l.end > 0n && BigInt(Math.floor(Date.now() / 1000)) > l.end); });

  return (
    <div className="page">
      <div className="screen">
        <h2>Market</h2>
        <div style={{ display: "flex", gap: 8, margin: "4px 0 14px" }}>
          
          <button type="button" style={tab(view === "list")} onClick={() => setView("list")}>Listings</button>
          <button type="button" style={tab(view === "mine")} onClick={() => setView("mine")}>My NFTs</button>
        </div>

        {view === "mine" ? (
          <MyNfts />
        ) : view === "list" ? (
          <Listings />
        ) : (
          <>
            <p className="sub">Collections launched on Rialo Studio</p>
            {error && <div className="err">{error}</div>}
            {!items && !error && <p className="fine">Loading collections...</p>}
            {items && shown.length === 0 && <p className="fine">No collections yet.</p>}

            <div style={{ display: "grid", gap: 16 }}>
              {shown.map((it) => {
                const l = live[it.id];
                const pct = l && l.max > 0n ? Math.min(100, (Number(l.minted) * 100) / Number(l.max)) : 0;
                const soldOut = !!l && l.minted >= l.max;
                return (
                  <div key={it.id} style={{ border: "3px solid #3b1a45", borderRadius: 20, padding: 14, background: "#fff" }}>
                    <div style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: 12, background: "linear-gradient(135deg,#b8a5ff,#ff9ecb)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {it.base ? (
                        <img src={it.base} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <span style={{ fontSize: 80, fontWeight: 900, color: "#3b1a45" }}>?</span>
                      )}
                    </div>
                    <h3 style={{ margin: "12px 0 2px" }}>{it.name || "Untitled"}{it.symbol ? ` (${it.symbol})` : ""}</h3>
                    {l ? (
                      <>
                        <p className="sub" style={{ margin: "0 0 8px" }}>
                          {l.minted.toString()} / {l.max.toString()} minted · {Number(l.price) / KELVIN} RIALO each
                          {l.perw > 0n ? ` · max ${l.perw.toString()} per wallet` : ""}
                        </p>
                        <div style={{ height: 10, borderRadius: 6, background: "#eadff0", overflow: "hidden", marginBottom: 12 }}>
                          <div style={{ width: pct + "%", height: "100%", background: "#3adfb4" }} />
                        </div>
                        {soldOut ? (
                          <p className="fine" style={{ margin: 0 }}>Sold out</p>
                        ) : (
                          <Link href={`/mint?c=${it.id}&t=${l.treasury}`} className="btn mint" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                            Mint
                          </Link>
                        )}
                      </>
                    ) : (
                      <p className="fine" style={{ margin: 0 }}>Loading...</p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
