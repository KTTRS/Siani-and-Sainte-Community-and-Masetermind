const DB_NAME = 'sainte-voice-offline';
const DB_VERSION = 1;
const RECORDINGS_STORE = 'recordings';
const TRANSCRIPTS_STORE = 'transcripts';
const RESPONSES_STORE = 'responses';

interface VoiceRecording {
  id: string;
  userId: string;
  audioBlob: Blob;
  mimeType: string;
  duration: number;
  timestamp: number;
  synced: boolean;
}

interface VoiceTranscript {
  id: string;
  recordingId: string;
  text: string;
  timestamp: number;
  synced: boolean;
}

interface VoiceResponse {
  id: string;
  transcriptId: string;
  responseText: string;
  audioUrl?: string;
  timestamp: number;
  played: boolean;
}

class OfflineVoiceStore {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(RECORDINGS_STORE)) {
          const recordingsStore = db.createObjectStore(RECORDINGS_STORE, { keyPath: 'id' });
          recordingsStore.createIndex('userId', 'userId', { unique: false });
          recordingsStore.createIndex('synced', 'synced', { unique: false });
          recordingsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        if (!db.objectStoreNames.contains(TRANSCRIPTS_STORE)) {
          const transcriptsStore = db.createObjectStore(TRANSCRIPTS_STORE, { keyPath: 'id' });
          transcriptsStore.createIndex('recordingId', 'recordingId', { unique: false });
          transcriptsStore.createIndex('synced', 'synced', { unique: false });
        }
        
        if (!db.objectStoreNames.contains(RESPONSES_STORE)) {
          const responsesStore = db.createObjectStore(RESPONSES_STORE, { keyPath: 'id' });
          responsesStore.createIndex('transcriptId', 'transcriptId', { unique: false });
          responsesStore.createIndex('played', 'played', { unique: false });
        }
      };
    });
    
    return this.initPromise;
  }

  async saveRecording(recording: VoiceRecording): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(RECORDINGS_STORE, 'readwrite');
      const store = transaction.objectStore(RECORDINGS_STORE);
      const request = store.put(recording);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getUnsynced(): Promise<VoiceRecording[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(RECORDINGS_STORE, 'readonly');
      const store = transaction.objectStore(RECORDINGS_STORE);
      const index = store.index('synced');
      const request = index.getAll(IDBKeyRange.only(false));
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async markSynced(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(RECORDINGS_STORE, 'readwrite');
      const store = transaction.objectStore(RECORDINGS_STORE);
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        const recording = getRequest.result;
        if (recording) {
          recording.synced = true;
          const putRequest = store.put(recording);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async saveTranscript(transcript: VoiceTranscript): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(TRANSCRIPTS_STORE, 'readwrite');
      const store = transaction.objectStore(TRANSCRIPTS_STORE);
      const request = store.put(transcript);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveResponse(response: VoiceResponse): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(RESPONSES_STORE, 'readwrite');
      const store = transaction.objectStore(RESPONSES_STORE);
      const request = store.put(response);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getRecentResponses(limit = 10): Promise<VoiceResponse[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(RESPONSES_STORE, 'readonly');
      const store = transaction.objectStore(RESPONSES_STORE);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const results = request.result
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRecording(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(RECORDINGS_STORE, 'readwrite');
      const store = transaction.objectStore(RECORDINGS_STORE);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearOldRecordings(maxAgeMs = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const db = await this.getDB();
    const cutoff = Date.now() - maxAgeMs;
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(RECORDINGS_STORE, 'readwrite');
      const store = transaction.objectStore(RECORDINGS_STORE);
      const index = store.index('timestamp');
      const range = IDBKeyRange.upperBound(cutoff);
      const request = index.openCursor(range);
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          if (cursor.value.synced) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async getStorageEstimate(): Promise<{ used: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    }
    return { used: 0, quota: 0 };
  }
}

export const offlineVoiceStore = new OfflineVoiceStore();

export function generateRecordingId(): string {
  return `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
