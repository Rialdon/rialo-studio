p = "src/lib.rs"
s = open(p).read()
def rep(a, b):
    global s
    assert s.count(a) == 1, "TIDAK COCOK: " + a
    s = s.replace(a, b)
rep("    account_info::{next_account_info, AccountInfo},\n", "    account_info::{next_account_info, AccountInfo},\n    clock::Clock,\n")
rep("    system_instruction,\n};", "    system_instruction,\n    sysvar::Sysvar,\n};")
rep("const COL_SIZE: usize = 283;", "const O_END: usize = 283;\nconst O_START: usize = 291;\nconst COL_SIZE: usize = 299;")
rep("const ERR_LIMIT: u32 = 2;", "const ERR_LIMIT: u32 = 2;\nconst ERR_ENDED: u32 = 3;\nconst ERR_NOT_STARTED: u32 = 4;")
rep("if d.len() < 43 {", "if d.len() < 59 {")
rep("let lamports = rd_u64(d, 32);", "let lamports = rd_u64(d, 32);\n    let end = rd_u64(d, 40);\n    let start = rd_u64(d, 48);")
rep("let mut p = 40usize;", "let mut p = 56usize;")
rep("wr_u64(&mut s[..], O_ID, id);", "wr_u64(&mut s[..], O_ID, id);\n    wr_u64(&mut s[..], O_END, end);\n    wr_u64(&mut s[..], O_START, start);")
rep("if s.len() < COL_SIZE || &s[O_TREAS", "if s.len() < O_END || &s[O_TREAS")
rep("let (price, max, minted, perw, id, auth, name, sym, base) = {", "let (price, max, minted, perw, id, auth, name, sym, base, (end, start)) = {")
rep("get_str(&s[..], O_URI),\n        )", "get_str(&s[..], O_URI),\n            if s.len() >= COL_SIZE { (rd_u64(&s[..], O_END), rd_u64(&s[..], O_START)) } else { (0, 0) },\n        )")
rep("        return Err(ProgramError::Custom(ERR_SOLD_OUT));\n    }\n", "        return Err(ProgramError::Custom(ERR_SOLD_OUT));\n    }\n    if end > 0 || start > 0 {\n        let now = Clock::get()?.unix_timestamp as u64;\n        if start > 0 && now < start {\n            return Err(ProgramError::Custom(ERR_NOT_STARTED));\n        }\n        if end > 0 && now > end {\n            return Err(ProgramError::Custom(ERR_ENDED));\n        }\n    }\n")
open(p, "w").write(s)
print("done")
