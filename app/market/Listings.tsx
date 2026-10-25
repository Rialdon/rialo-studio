"use client";

import { useEffect, useState, CSSProperties } from "react";
import { useRialoWallet } from "../providers";
import { KELVIN } from "../../lib/collection";
import * as L from "../../lib/collection";
import {
  readListing,
  nftMeta,
  buyNft,
  cancelListing,
  waitListing,
} from "../../lib/market";

type Row = {
  mint: string;
  seller: string;
  price: bigint;
  name: string;
  image: string;
};

const smallBtn: CSSProperties = {
  width: "100%",
  height: 36,
  borderRadius: 12,
  border: "3px solid #3b1a45",
  background: "#3adfb4",
  color: "#3b1a45",
  fontWeight: 900,
  cursor: "pointer",
  marginTop: 6,
};

export default function Listings() {
  const { address, isConnected, connect, signAndSend } =
    useRialoWallet();

  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [done, setDone] = useState<{ title: string; name: string; image: string; price: bigint; sig: string } | null>(null);

  async function load() {
    try {
      setError("");

      const r = await fetch("/api/listings", {
        cache: "no-store",
      });

      const j = await r.json();

      if (!r.ok) {
        throw new Error(j.error || "Failed to load listings");
      }

      const mints: string[] = j.mints || [];

      const got = await Promise.all(
        mints.map(async (m): Promise<Row | null> => {
          const l = await readListing(m);

          if (!l || !l.active) return null;

          const meta = await nftMeta(m);

          return {
            mint: m,
            seller: l.seller,
            price: l.price,
            name: meta?.name || "NFT",
            image: meta?.image || "",
          };
        }),
      );

      setRows(got.filter(Boolean) as Row[]);
    } catch (e: any) {
      setError(String(e?.message || e).slice(0, 300));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function act(row: Row, mine: boolean) {
    setBusy(row.mint);
    let res: any;
    setError("");

    try {
      if (mine) {
        res = await cancelListing(address!, row.mint, signAndSend);
      } else {
        res = await buyNft(
          address!,
          row.seller,
          row.mint,
          signAndSend,
        );
      }

      const ok = await waitListing(row.mint, false);

      if (!ok) {
        throw new Error(
          "Not confirmed yet. Refresh in a moment.",
        );
      }

      const sg = res && (L as any).sigOf ? (L as any).sigOf(res) : "";
      setDone({ title: mine ? "Listing cancelled!" : "Purchase Successful!", name: row.name, image: row.image, price: row.price, sig: typeof sg === "string" ? sg : "" });
      await load();
    } catch (e: any) {
      setError(String(e?.message || e).slice(0, 300));
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      {done && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 20, border: "3px solid #3b1a45", padding: 20, maxWidth: 380, width: "100%", maxHeight: "90vh", overflowY: "auto", textAlign: "center" }}>
            <h3 style={{ margin: "0 0 12px" }}>{done.title}</h3>
            {done.image ? <img src={done.image} alt="" style={{ width: "100%", borderRadius: 12 }} /> : null}
            <p style={{ fontWeight: 800, margin: "8px 0 0" }}>{done.name}</p>
            {done.title.startsWith("Purchase") ? <p style={{ fontSize: 12, margin: "2px 0 0" }}>Paid {Number(done.price) / KELVIN} RIALO</p> : null}
            {done.sig && (L as any).EXPLORER ? (
              <p style={{ fontSize: 11, margin: "4px 0 0" }}>
                <a href={(L as any).EXPLORER + "/txs/" + done.sig} target="_blank" rel="noreferrer">View transaction</a>
              </p>
            ) : null}
            <button className="btn" style={{ marginTop: 14 }} onClick={() => setDone(null)}>OK</button>
          </div>
        </div>
      )}
    <div>
      <p className="sub">NFTs for sale</p>

      {error && <div className="err">{error}</div>}

      {!rows && !error && (
        <p className="fine">Loading listings...</p>
      )}

      {rows && rows.length === 0 && (
        <p className="fine">Nothing for sale yet.</p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        {(rows || []).map((n) => {
          const mine = !!address && n.seller === address;

          return (
            <div
              key={n.mint}
              style={{
                border: "3px solid #3b1a45",
                borderRadius: 16,
                padding: 8,
                background: "#fff",
              }}
            >
              {n.image ? (
                <img
                  src={n.image}
                  alt=""
                  style={{ width: "100%", borderRadius: 10 }}
                />
              ) : (
                <div
                  style={{
                    aspectRatio: "1 / 1",
                    borderRadius: 10,
                    background: "#eadff0",
                  }}
                />
              )}

              <p
                style={{
                  margin: "6px 0 0",
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                {n.name}
              </p>

              <p style={{ margin: 0, fontSize: 13 }}>
                {Number(n.price) / KELVIN} RIALO
              </p>

              {!isConnected ? (
                <button
                  type="button"
                  style={smallBtn}
                  onClick={connect}
                >
                  Connect
                </button>
              ) : (
                <button
                  type="button"
                  style={
                    mine
                      ? { ...smallBtn, background: "#ffd84a" }
                      : smallBtn
                  }
                  disabled={!!busy}
                  onClick={() => act(n, mine)}
                >
                  {busy === n.mint
                    ? "Working..."
                    : mine
                      ? "Cancel"
                      : "Buy"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
}
