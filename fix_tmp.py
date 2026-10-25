p = "app/page.tsx"
s = open(p).read()

def need(x):
    assert x in s, "tidak ketemu: " + x[:40]

need('import Link from "next/link";')
need("function Candy")
need("const FEATURES")
need('<div className="lp-art" aria-hidden="true">')

s = s.replace('import Link from "next/link";', 'import Link from "next/link";\nimport type { CSSProperties } from "react";', 1)

cards = '''const CARDS = [
  { name: "Studio #1", price: "0.1 RIALO", bg: "#cbbcff", rot: "-9deg" },
  { name: "Studio #2", price: "0.1 RIALO", bg: "#9af0d6", rot: "7deg" },
  { name: "Studio #3", price: "0.1 RIALO", bg: "#fff1f7", rot: "5deg" },
  { name: "Studio #4", price: "0.1 RIALO", bg: "#bfe8ff", rot: "-7deg" },
];

'''
a = s.index("function Candy")
b = s.index("const FEATURES")
s = s[:a] + cards + s[b:]

art = '''<div className="lp-art" aria-hidden="true">
          {CARDS.map((c, i) => (
            <div key={c.name} className={`lp-tcard t${i + 1}`} style={{ "--r": c.rot } as CSSProperties}>
              <div className="lp-tcard-img" style={{ background: c.bg }}>
                <img src="/logo.png" alt="" />
              </div>
              <b>{c.name}</b>
              <small>{c.price}</small>
            </div>
          ))}
        </div>'''
a = s.index('<div className="lp-art" aria-hidden="true">')
e = s.index("</section>", a)
s = s[:a] + art + "\n      " + s[e:]
open(p, "w").write(s)
print("OK")
