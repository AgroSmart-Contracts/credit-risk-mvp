/**
 * Creates one invited bank account. Prints its entry for the BANK_USERS variable, and the
 * one-time credentials to hand over privately. Nothing is written to disk.
 *   npm run bank:add-user -- "Full Name" person@bank.com        password only
 *   npm run bank:add-user -- "Full Name" person@bank.com --2fa  password + authenticator code
 */
import crypto from "node:crypto";

const args = process.argv.slice(2);
const use2fa = args.includes("--2fa");
const [name, email] = args.filter((a) => a !== "--2fa");
if (!name || !email?.includes("@")) {
  console.error('Usage: npm run bank:add-user -- "Full Name" person@bank.com');
  process.exit(1);
}
const b32 = (buf) => {
  const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const b of buf) bits += b.toString(2).padStart(8, "0");
  return (bits.match(/.{1,5}/g) ?? []).map((x) => a[parseInt(x.padEnd(5, "0"), 2)]).join("");
};
const password = crypto.randomBytes(18).toString("base64url");
const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const totp = use2fa ? b32(crypto.randomBytes(20)) : undefined;
const entry = { id: crypto.randomUUID(), name, email, salt: salt.toString("base64"), hash: hash.toString("base64"), totp, version: 1 };
const uri = `otpauth://totp/TruMarket:${encodeURIComponent(email)}?secret=${totp}&issuer=TruMarket&digits=6&period=30`;

console.log("Add to the BANK_USERS JSON array:\n" + JSON.stringify(entry));
console.log("\nGive to the user through a private channel, once:");
console.log(`Password: ${password}`);
if (use2fa) {
  console.log(`Authenticator setup key: ${totp}`);
  console.log(`Authenticator link: ${uri}`);
}
