import { randomBytes } from "./random-bytes.js";
import { createHash } from "./create-hash.js";
import { scrypt } from "./scrypt.js";

export const cryptoShim = {
  randomBytes,
  createHash,
  scrypt,
};
