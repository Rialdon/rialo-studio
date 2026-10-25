"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { loadCdk } from "../lib/cdk";
import { b58, KELVIN } from "../lib/collection";
import { HIDDEN } from "../lib/hidden";

type Item = { id: string; name: string; symbol: string; description: string; base: string };
type Live = { price: bigint; max: bigint; minted: bigint; perw: bigint; treasury: string; end: bigint; start: bigint };

const left = (s: number) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${Math.max(1, m)}m`;
};

export default function Collections() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [live, setLive] = useState<Record<string, Live | null>>({});
  const [error, setError] = useState("");
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/collections", { cache: "no-store" });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed to load collections");
        const list: Item[] = (j.items || []).filter((it: Item) => !HIDDEN.includes(it.id));
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
                start: u.length >= 299 ? dv.getBigUint64(291, true) : 0n,
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

  const ended = (l: Live | null | undefined) => !!l && l.end > 0n && BigInt(now) > l.end;
  const soldOut = (l: Live | null | undefined) => !!l && l.minted >= l.max;
  const shown = (items || [])
    .filter((it) => live[it.id] != null && !ended(live[it.id]))
    .sort((x, y) => Number(soldOut(live[x.id])) - Number(soldOut(live[y.id])));
  const pending = !!items && items.some((it) => live[it.id] === undefined);

  return (
    <div className="screen">
      <h2>Live mints</h2>
      <p className="sub">Collections launched on Rialo Studio</p>
      {error && <div className="err">{error}</div>}
      {!items && !error && <p className="fine">Loading collections...</p>}
      {items && shown.length === 0 && <p className="fine">{pending ? "Loading collections..." : "No collections yet."}</p>}

      <div style={{ display: "grid", gap: 16 }}>
        {shown.map((it) => {
          const l = live[it.id];
          const pct = l && l.max > 0n ? Math.min(100, (Number(l.minted) * 100) / Number(l.max)) : 0;
          const notStarted = !!l && l.start > 0n && BigInt(now) < l.start;
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
                  <p className="sub" style={{ margin: "0 0 4px" }}>
                    {l.minted.toString()} / {l.max.toString()} minted · {Number(l.price) / KELVIN} RIALO each
                    {l.perw > 0n ? ` · max ${l.perw.toString()} per wallet` : ""}
                  </p>
                  {l.end > 0n && !soldOut(l) && !notStarted && (
                    <p className="sub" style={{ margin: "0 0 8px", fontWeight: 800 }}>
                      Ends in {left(Number(l.end) - now)} · {new Date(Number(l.end) * 1000).toLocaleString()}
                    </p>
                  )}
                  {notStarted && (
                    <p className="sub" style={{ margin: "0 0 8px", fontWeight: 800 }}>
                      Starts in {left(Number(l.start) - now)} · {new Date(Number(l.start) * 1000).toLocaleString()}
                    </p>
                  )}
                  <div style={{ height: 10, borderRadius: 6, background: "#eadff0", overflow: "hidden", marginBottom: 12 }}>
                    <div style={{ width: pct + "%", height: "100%", background: "#3adfb4" }} />
                  </div>
                  {soldOut(l) ? (
                    <p className="fine" style={{ margin: 0 }}>Sold out</p>
                  ) : notStarted ? (
                    <p className="fine" style={{ margin: 0 }}>Not started yet</p>
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
    </div>
  );
}
