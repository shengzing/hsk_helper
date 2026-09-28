/** Client-side crypto utilities for decrypting server-encrypted content.
 *  Uses Web Crypto API (SubtleCrypto) with ECDH key exchange and AES-GCM. */

async function importPublicKey(pem: string): Promise<CryptoKey> {
  const base64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const der = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("spki", der, { name: "ECDH", namedCurve: "P-256" }, false, []);
}

async function deriveBits(privateKey: CryptoKey, publicKey: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
}

export async function generateKeyPair(): Promise<{ publicKey: string; privateKey: CryptoKey }> {
  const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]);
  const exported = await crypto.subtle.exportKey("spki", kp.publicKey);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
  const pem = `-----BEGIN PUBLIC KEY-----\n${base64}\n-----END PUBLIC KEY-----`;
  return { publicKey: pem, privateKey: kp.privateKey };
}

export async function decryptContent(
  encryptedBase64: string,
  ivBase64: string,
  privateKey: CryptoKey,
  serverPublicKeyPem: string,
): Promise<string> {
  const serverKey = await importPublicKey(serverPublicKeyPem);
  const sharedBits = await deriveBits(privateKey, serverKey);

  const key = await crypto.subtle.importKey("raw", sharedBits, { name: "AES-GCM" }, false, ["decrypt"]);
  const iv = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0));
  const encrypted = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
  return new TextDecoder().decode(decrypted);
}
