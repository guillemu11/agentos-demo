import { encrypt, decrypt } from '../aes-gcm.js';

const KEY = 'a'.repeat(64); // 32 bytes hex = 64 chars

describe('aes-gcm', () => {
  it('roundtrips a string', () => {
    const plaintext = 'hello-secret-token';
    const ciphertext = encrypt(plaintext, KEY);
    expect(ciphertext).not.toContain('hello');
    expect(decrypt(ciphertext, KEY)).toBe(plaintext);
  });

  it('produces different ciphertext each call (random iv)', () => {
    const a = encrypt('same', KEY);
    const b = encrypt('same', KEY);
    expect(a).not.toBe(b);
  });

  it('fails decrypt with wrong key', () => {
    const ct = encrypt('x', KEY);
    const wrong = 'b'.repeat(64);
    expect(() => decrypt(ct, wrong)).toThrow();
  });

  it('fails decrypt with tampered ciphertext', () => {
    const ct = encrypt('x', KEY);
    const tampered = ct.slice(0, -2) + '00';
    expect(() => decrypt(tampered, KEY)).toThrow();
  });
});
