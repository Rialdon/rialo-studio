import Link from "next/link";
import "./landing.css";

const WALLET_STORE =
  "https://chromewebstore.google.com/detail/rialo-wallet/dbmgekigjgnahdnfgfpdognodiegpmcg";

function Candy({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ color }} aria-hidden="true">
      <path d="M6 18 L22 28 L22 36 L6 46 Z" fill="currentColor" stroke="#3b1d3f" strokeWidth="3" strokeLinejoin="round" />
      <path d="M58 18 L42 28 L42 36 L58 46 Z" fill="currentColor" stroke="#3b1d3f" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="32" cy="32" r="16" fill="currentColor" stroke="#3b1d3f" strokeWidth="3" />
      <path d="M22 26 Q32 18 42 26" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      <circle cx="27" cy="33" r="2.2" fill="#3b1d3f" />
      <circle cx="37" cy="33" r="2.2" fill="#3b1d3f" />
      <path d="M28 39 Q32 42 36 39" fill="none" stroke="#3b1d3f" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

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
  { q: "Is this real money?", a: "No. Rialo Studio runs on Rialo Testnet only, with test tokens. It is not audited." },
];

export default function Landing() {
  return (
    <div className="lp">
      <section className="lp-hero">
        <div className="lp-hero-text">
          <span className="lp-badge">Rialo Testnet</span>
          <h1>Launch tokens and NFTs on Rialo in a few taps</h1>
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
          <div className="lp-candy c1"><Candy color="#8b5cf6" size={150} /></div>
          <div className="lp-candy c2"><Candy color="#ff5fa2" size={110} /></div>
          <div className="lp-candy c3"><Candy color="#3ddbb0" size={90} /></div>
          <div className="lp-candy c4"><Candy color="#ffd84d" size={70} /></div>
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
