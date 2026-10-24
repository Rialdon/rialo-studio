"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRialoWallet } from "./providers";

export default function TopBar() {
  const { isConnected, address, connect, disconnect, installed } = useRialoWallet();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div className="topbar">
      <Link href="/" className="brand">
        <svg width="30" height="30" viewBox="0 0 64 64" style={{ color: "var(--pink)" }}>
          <path d="M6 18 L22 28 L22 36 L6 46 Z" fill="currentColor" stroke="#3b1d3f" strokeWidth="3" strokeLinejoin="round" />
          <path d="M58 18 L42 28 L42 36 L58 46 Z" fill="currentColor" stroke="#3b1d3f" strokeWidth="3" strokeLinejoin="round" />
          <circle cx="32" cy="32" r="16" fill="currentColor" stroke="#3b1d3f" strokeWidth="3" />
          <circle cx="27" cy="33" r="2.2" fill="#3b1d3f" />
          <circle cx="37" cy="33" r="2.2" fill="#3b1d3f" />
          <path d="M28 39 Q32 42 36 39" fill="none" stroke="#3b1d3f" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
        <span>Rialo <b>Studio</b></span>
      </Link>
      <div ref={ref} style={{ position: "relative" }}>
        {isConnected ? (
          <>
            <button className="pill" onClick={() => setOpen((o) => !o)}>
              {address!.slice(0, 6)}...{address!.slice(-4)} {open ? "▲" : "▼"}
            </button>
            {open && (
              <div className="menu">
                <button className="red" onClick={() => { setOpen(false); disconnect(); }}>Logout</button>
              </div>
            )}
          </>
        ) : (
          <button className="pill" onClick={connect}>{installed ? "Connect wallet" : "Install wallet"}</button>
        )}
      </div>
    </div>
  );
}
