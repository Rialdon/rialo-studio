import Link from "next/link";
import type { CSSProperties } from "react";
import "./landing.css";

const WALLET_STORE =
  "https://chromewebstore.google.com/detail/rialo-wallet/dbmgekigjgnahdnfgfpdognodiegpmcg";

const CARDS = [
  { name: "Studio #1", price: "0.1 RIALO", bg: "#cbbcff", rot: "-9deg" },
  { name: "Studio #2", price: "0.1 RIALO", bg: "#9af0d6", rot: "7deg" },
  { name: "Studio #3", price: "0.1 RIALO", bg: "#fff1f7", rot: "5deg" },
  { name: "Studio #4", price: "0.1 RIALO", bg: "#bfe8ff", rot: "-7deg" },
];

const FEATURES = [
  { icon: "T", title: "Create token", text: "Name, symbol, decimals and supply. Lock the supply when you are done.", href: "/token", bg: "#fff6d6" },
  { icon: "1", title: "Create NFT", text: "Turn one image into a 1-of-1 NFT that shows up in your wallet.", href: "/nft", bg: "#e6f7ff" },
  { icon: "N", title: "Launch collection", text: "Upload a base image and accessories, set rarity, and let each mint reveal its traits.", href: "/collection", bg: "#ffe3ef" },
  { icon: "$", title: "Market", text: "Browse collections, list what you own, and buy from other collectors.", href: "/market", bg: "#e3fbf3" },
];

const STEPS = [
  { n: "1", title: "Connect your wallet", text: "Install the Rialo Wallet extension and connect. Nothing moves until you approve." },
  { n: "2", title: "Pick what to make", text: "Fill in a short form: a token, a single NFT, or a whole collection." },
  { n: "3", title: "Approve and share", text: "Confirm once in your wallet. Your token or collection is live on Rialo Testnet." },
];

const FAQ = [
  { q: "Do I need to write code?", a: "No. Everything is a form: fill it in, approve in your wallet, done." },
  { q: "Which wallet do I need?", a: "The Rialo Wallet browser extension. Phones with a browser that supports extensions also work." },
  { q: "Is this real money?", a: "No. Rialo Studio runs on Rialo Testnet only, with Rialo test tokens." },
];

export default function Landing() {
  return (
    <div className="lp">
      <section className="lp-hero">
        <div className="lp-hero-text">
          <span className="lp-badge">Rialo Testnet</span>
          <h1>Launch tokens and NFTs on Rialo Testnet.</h1>
          <p className="lp-lead">
            Create a token, mint an NFT, or launch a whole generative collection.
            No code, one approval in your Rialo Wallet.
          </p>
          <div className="lp-cta">
            <Link className="lp-btn" href="/studio">Open Studio</Link>
            <Link className="lp-btn lp-btn-alt" href="/market">Browse market</Link>
          </div>
          
        </div>
        <div className="lp-art" aria-hidden="true">
          {CARDS.map((c, i) => (
            <div key={c.name} className={`lp-tcard t${i + 1}`} style={{ "--r": c.rot } as CSSProperties}>
              <div className="lp-tcard-img" style={{ background: c.bg }}>
                <img src="/logo.png" alt="" />
              </div>
              <b>{c.name}</b>
              <small>{c.price}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <h2>Everything you need to launch</h2>
        <p className="lp-sub">Four tools, one place.</p>
        <div className="lp-grid">
          {FEATURES.map((f) => (
            <Link key={f.title} href={f.href} className="lp-card" style={{ background: f.bg }}>
              <div className="lp-ico">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
              <span className="lp-link">Open</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <h2>How it works</h2>
        <p className="lp-sub">Three steps, about a minute.</p>
        <div className="lp-steps">
          {STEPS.map((s) => (
            <div key={s.n} className="lp-step">
              <div className="lp-num">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <h2>Questions</h2>
        <div className="lp-faq">
          {FAQ.map((f) => (
            <div key={f.q} className="lp-qa">
              <h3>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-band">
        <h2>Ready to make something?</h2>
        <p>Open the Studio and launch your first token or NFT.</p>
        <div className="lp-cta" style={{ justifyContent: "center" }}>
          <Link className="lp-btn" href="/studio">Open Studio</Link>
          <a className="lp-btn lp-btn-alt" href={WALLET_STORE} target="_blank" rel="noreferrer">Get Rialo Wallet</a>
        </div>
      </section>

      <footer className="lp-foot">
        <span>©Rialo Studio</span>
        <span>Rialo Testnet</span>
      </footer>
    </div>
  );
}
