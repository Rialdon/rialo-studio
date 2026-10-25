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
        <img src="/logo.png" width={42} height={42} alt="" />
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
