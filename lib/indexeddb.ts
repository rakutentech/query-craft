// lib/indexeddb.ts
interface CacheData {
  key: string;
  value: any;
  timestamp: number;
}

class IndexedDBCache {
  private dbName = 'QueryCraftCache';
  private version = 1;
  private storeName = 'cache';

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async set(key: string, value: any, ttlMinutes?: number): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const data: CacheData = {
        key,
        value,
        timestamp: Date.now()
      };
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(data);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      db.close();
    } catch (error) {
      console.warn(`Failed to store ${key} in IndexedDB:`, error);
      // Fallback to localStorage for small data
      if (this.isSmallData(value)) {
        try {
          localStorage.setItem(key, JSON.stringify({ value, timestamp: Date.now() }));
        } catch (e) {
          console.warn(`Fallback to localStorage also failed for ${key}:`, e);
        }
      }
    }
  }

  async get(key: string, ttlMinutes?: number): Promise<any> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      const data = await new Promise<CacheData | undefined>((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      db.close();
      
      if (data) {
        // Check TTL if provided
        if (ttlMinutes && Date.now() - data.timestamp > ttlMinutes * 60 * 1000) {
          await this.remove(key);
          return null;
        }
        return data.value;
      }
      
      return null;
    } catch (error) {
      console.warn(`Failed to get ${key} from IndexedDB:`, error);
      // Fallback to localStorage
      try {
        const item = localStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item);
          if (ttlMinutes && Date.now() - parsed.timestamp > ttlMinutes * 60 * 1000) {
            localStorage.removeItem(key);
            return null;
          }
          return parsed.value;
        }
      } catch (e) {
        console.warn(`Fallback localStorage get also failed for ${key}:`, e);
      }
      return null;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      db.close();
    } catch (error) {
      console.warn(`Failed to remove ${key} from IndexedDB:`, error);
      // Fallback to localStorage
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn(`Fallback localStorage remove also failed for ${key}:`, e);
      }
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      db.close();
    } catch (error) {
      console.warn('Failed to clear IndexedDB:', error);
      // Clear localStorage as fallback
      try {
        localStorage.clear();
      } catch (e) {
        console.warn('Fallback localStorage clear also failed:', e);
      }
    }
  }

  async cleanupExpired(): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      
      // Remove items older than 24 hours
      const expiredTime = Date.now() - (24 * 60 * 60 * 1000);
      const range = IDBKeyRange.upperBound(expiredTime);
      
      await new Promise<void>((resolve, reject) => {
        const request = index.openCursor(range);
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      });
      
      db.close();
    } catch (error) {
      console.warn('Failed to cleanup expired IndexedDB entries:', error);
    }
  }

  private isSmallData(value: any): boolean {
    try {
      return JSON.stringify(value).length < 1000000; // 1MB limit for localStorage fallback
    } catch {
      return false;
    }
  }
}

export const indexedDBCache = new IndexedDBCache();

// Convenience methods that mirror localStorage API
export const cacheStorage = {
  async setItem(key: string, value: any, ttlMinutes?: number): Promise<void> {
    await indexedDBCache.set(key, value, ttlMinutes);
  },
  
  async getItem(key: string, ttlMinutes?: number): Promise<any> {
    return await indexedDBCache.get(key, ttlMinutes);
  },
  
  async removeItem(key: string): Promise<void> {
    await indexedDBCache.remove(key);
  },
  
  async clear(): Promise<void> {
    await indexedDBCache.clear();
  }
};

// Run cleanup on startup
if (typeof window !== 'undefined') {
  indexedDBCache.cleanupExpired().catch(console.warn);
}