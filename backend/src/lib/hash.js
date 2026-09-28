import fs from 'node:fs';
import crypto from 'node:crypto';

/** SHA-256 of a file, computed as a stream (memory safe for large files). */
export function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

/** SHA-256 of a string (UTF-8). */
export function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/** SHA-256 of raw bytes — matches sha256File exactly. */
export function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export const GENESIS_HASH = '0'.repeat(64);

/**
 * Tamper-evident chain hash linking a document to its predecessor:
 *   chain = SHA256(prevChain | contentHash | docNumber)
 * Recomputing this for every document exposes any metadata tampering.
 */
export function computeChainHash(prevHash, contentHash, docNumber) {
  return sha256(`${prevHash}|${contentHash}|${docNumber}`);
}
