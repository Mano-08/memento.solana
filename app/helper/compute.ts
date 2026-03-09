export function u16ToLeBytes(value: number): Uint8Array {
  const buf = new ArrayBuffer(2); // 2 bytes
  const view = new DataView(buf);
  view.setUint16(0, value, true); // little-endian
  return new Uint8Array(buf);
}

export function getToday() {
  const today = new Date();

  // Format the date to YYYY-MM-DD (required for the min attribute)
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0"); // January is 0
  const day = String(today.getDate()).padStart(2, "0");

  const formattedDate = `${year}-${month}-${day}`;
  return formattedDate;
}

export function formatDate(dateInSeconds: bigint) {
  const dateInMilliSeconds = dateInSeconds * 1000n;
  const dateAsNumber = Number(dateInMilliSeconds);
  const date = new Date(dateAsNumber);

  // Format the date to YYYY-MM-DD (required for the min attribute)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // January is 0
  const day = String(date.getDate()).padStart(2, "0");

  const formattedDate = `${day}-${month}-${year}`;
  return formattedDate;
}

/**
 * Recursively hashes a Uint8Array using SHA-256 N times.
 * @param {Uint8Array} data - The input data as a Uint8Array.
 * @param {number} n - The number of times to hash the data.
 * @returns {Promise<Uint8Array>} - The resulting Uint8Array after N hashes.
 */
export async function recursiveSha256(
  data: Uint8Array<ArrayBuffer>,
  n: number
): Promise<Uint8Array> {
  if (n <= 0) throw new Error("N must be greater than 0");
  let current: Uint8Array<ArrayBuffer> = data;
  for (let i = 0; i < n; i++) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", current);
    current = new Uint8Array(hashBuffer);
  }
  return current;
}

export async function encryptQuestion(
  question: string,
  phone: string,
  salt: Uint8Array<ArrayBuffer>
): Promise<string> {
  const enc = new TextEncoder();

  // Concatenate phone + salt (Uint8Array)
  const phoneBytes = enc.encode(phone);
  // salt is already Uint8Array
  const phoneSaltBytes = new Uint8Array(phoneBytes.length + salt.length);
  phoneSaltBytes.set(phoneBytes, 0);
  phoneSaltBytes.set(salt, phoneBytes.length);

  const derivedKeyMaterial = await window.crypto.subtle.importKey(
    "raw",
    phoneSaltBytes,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("solgift_static_salt"), // TODO: change this
      iterations: 100_000,
      hash: "SHA-256",
    },
    derivedKeyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(question)
  );
  // Combine iv + ciphertext as base64 string
  const buf = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  buf.set(iv, 0);
  buf.set(new Uint8Array(ciphertext), iv.byteLength);
  return btoa(String.fromCharCode(...buf));
}

export async function decryptQuestion(
  encrypted: string,
  salt: Uint8Array<ArrayBuffer>,
  phone: string
): Promise<string> {
  const enc = new TextEncoder();

  // Concatenate phone + salt (Uint8Array)
  const phoneBytes = enc.encode(phone);
  // salt is already Uint8Array
  const phoneSaltBytes = new Uint8Array(phoneBytes.length + salt.length);
  phoneSaltBytes.set(phoneBytes, 0);
  phoneSaltBytes.set(salt, phoneBytes.length);

  const derivedKeyMaterial = await window.crypto.subtle.importKey(
    "raw",
    phoneSaltBytes,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("solgift_static_salt"), // TODO: Change this
      iterations: 100_000,
      hash: "SHA-256",
    },
    derivedKeyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  // Decode from base64 to Uint8Array
  const encryptedBytes = Uint8Array.from(atob(encrypted), (c) =>
    c.charCodeAt(0)
  );
  // IV is 12 bytes (AES-GCM standard)
  const iv = encryptedBytes.slice(0, 12);
  const ciphertext = encryptedBytes.slice(12);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  // Convert ArrayBuffer to string
  const dec = new TextDecoder();
  return dec.decode(decryptedBuffer);
}
