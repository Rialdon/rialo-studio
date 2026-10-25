p = "src/lib.rs"
s = open(p).read()
a = "let now = Clock::get()?.unix_timestamp as u64;"
assert s.count(a) == 1, "TIDAK COCOK"
s = s.replace(a, "let raw = Clock::get()?.unix_timestamp;\n        let mut now = if raw > 0 { raw as u64 } else { 0 };\n        if now > 100_000_000_000 {\n            now /= 1000;\n        }")
open(p, "w").write(s)
print("done")
