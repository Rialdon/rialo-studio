import { PublicKey, createRialoClient, getDefaultRialoClientConfig } from "@rialo/ts-cdk";
const mint = process.argv[2];
const client = createRialoClient(getDefaultRialoClientConfig("testnet"));
const a = await client.getAccountInfo(PublicKey.fromString(mint));
if (!a) { console.log("Akun tidak ditemukan"); process.exit(1); }
const d = Buffer.from(a.data[0], "base64");
console.log("Ukuran:", d.length, "| desimal:", d[44], "| supply:", d.readBigUInt64LE(36).toString());
(d.toString("latin1").match(/[ -~]{4,}/g) || []).forEach((t) => console.log(" -", t));
