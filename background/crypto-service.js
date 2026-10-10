import { STORAGE_KEYS } from '../shared/storage-keys.js';
import { ENCRYPTION_CONFIG } from '../shared/constants.js';

const globalCrypto = typeof window !== 'undefined' ? window.crypto : self.crypto;
const globalBtoa = typeof window !== 'undefined' ? window.btoa : self.btoa;
const globalAtob = typeof window !== 'undefined' ? window.atob : self.atob;

class CryptoService {
  constructor() {
    this.key = null;
    this.sharedKey = null; // 用于 API 通信的共享密钥
  }

  async init() {
    const storedKey = await this.getStoredKey();
    if (storedKey) {
      this.key = await globalCrypto.subtle.importKey(
        'raw',
        this.base64ToArrayBuffer(storedKey),
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    } else {
      await this.generateAndStoreKey();
    }
    
    // 初始化共享密钥（用于 API 通信）
    await this.initSharedKey();
  }

  /**
   * 初始化共享密钥（从配置的密钥派生）
   * 用于与后端 API 的加密通信
   */
  async initSharedKey() {
    try {
      const encoder = new TextEncoder();
      const keyMaterial = encoder.encode(ENCRYPTION_CONFIG.SECRET);
      const salt = new Uint8Array(ENCRYPTION_CONFIG.SALT_LENGTH);
      
      this.sharedKey = await globalCrypto.subtle.importKey(
        'raw',
        keyMaterial,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      
      // 注意：实际使用时需要用相同的 salt 派生密钥
      // 这里只是初始化，具体派生会在 encrypt/decrypt 方法中完成
    } catch (error) {
      console.error('[CryptoService] 初始化共享密钥失败:', error);
    }
  }

  /**
   * 使用共享密钥加密数据（用于 API 通信）
   * @param {string} text - 要加密的文本
   * @param {Uint8Array} salt - 盐值（需要与解密方一致）
   * @returns {Promise<{iv: string, ciphertext: string, salt: string}>}
   */
  async encryptWithSharedKey(text, salt = null) {
    if (!this.sharedKey) await this.initSharedKey();
    
    const encoder = new TextEncoder();
    const actualSalt = salt || globalCrypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.SALT_LENGTH));
    const iv = globalCrypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.IV_LENGTH));
    
    // 派生密钥
    const derivedKey = await globalCrypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: actualSalt,
        iterations: ENCRYPTION_CONFIG.ITERATIONS,
        hash: 'SHA-256'
      },
      this.sharedKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    const data = encoder.encode(text);
    const ciphertext = await globalCrypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      derivedKey,
      data
    );
    
    return {
      iv: this.arrayBufferToBase64(iv),
      ciphertext: this.arrayBufferToBase64(ciphertext),
      salt: this.arrayBufferToBase64(actualSalt)
    };
  }

  async generateAndStoreKey() {
    this.key = await globalCrypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    const exportedKey = await globalCrypto.subtle.exportKey('raw', this.key);
    const base64Key = this.arrayBufferToBase64(exportedKey);
    await chrome.storage.local.set({ [STORAGE_KEYS.CRYPTO_KEY]: base64Key });
  }

  async getStoredKey() {
    const result = await chrome.storage.local.get([STORAGE_KEYS.CRYPTO_KEY]);
    return result[STORAGE_KEYS.CRYPTO_KEY] || null;
  }

  async encrypt(text) {
    if (!this.key) await this.init();
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const iv = globalCrypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await globalCrypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      this.key,
      data
    );
    return {
      iv: this.arrayBufferToBase64(iv),
      ciphertext: this.arrayBufferToBase64(ciphertext)
    };
  }

  async decrypt(encryptedData) {
    if (!this.key) await this.init();
    const iv = this.base64ToArrayBuffer(encryptedData.iv);
    const ciphertext = this.base64ToArrayBuffer(encryptedData.ciphertext);
    const decrypted = await globalCrypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      this.key,
      ciphertext
    );
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return globalBtoa(binary);
  }

  base64ToArrayBuffer(base64) {
    const binary_string = globalAtob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export const cryptoService = new CryptoService();
