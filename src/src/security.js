import crypto from "node:crypto";

export function createToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

export function createState() {
  return crypto.randomBytes(24).toString("hex");
}

export function hashValue(value) {
  return crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex");
}
