import Link from "next/link";

export default function Home() {
  return (
    <div className="page">
      <div className="screen">
        <h1>What do you want to make?</h1>
        <p className="sub">Launch tokens and NFTs on Rialo Testnet in a few taps.</p>
        <div className="tiles">
          <Link href="/token" className="tile" style={{ background: "#fff6d6" }}>
            <div className="ico">T</div>
            <b>Create token</b>
            <small>Name, symbol, supply</small>
          </Link>
          <Link href="/nft" className="tile" style={{ background: "#e6f7ff" }}>
            <div className="ico">1</div>
            <b>Create NFT</b>
            <small>Mint a 1-of-1 NFT</small>
          </Link>
          <Link href="/collection" className="tile" style={{ background: "#ffe3ef" }}>
            <div className="ico">N</div>
            <b>Launch collection</b>
            <small>Each image = one NFT</small>
          </Link>
          <Link href="/market" className="tile" style={{ background: "#e3fbf3" }}>
            <div className="ico">$</div>
            <b>Market</b>
            <small>Browse collections</small>
          </Link>
        </div>
      </div>
      <p className="fine">Rialo Testnet only. Not audited.</p>
    </div>
  );
}
