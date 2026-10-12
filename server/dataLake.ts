import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface DataLakeFile {
  data: Buffer;
  contentType: string;
  size: number;
}

export interface DataLakeProvider {
  ensureBucket(): Promise<boolean>;
  storeAnalytics(category: string, data: Record<string, any>): Promise<string | null>;
  storeReport(reportType: string, content: string, format: 'json' | 'csv'): Promise<string | null>;
  listFiles(prefix: string, limit?: number): Promise<{ name: string; id: string; createdAt: Date | null }[]>;
  getFile(path: string): Promise<DataLakeFile | null>;
  getFileStream(path: string): Promise<NodeJS.ReadableStream | null>;
  deleteFiles(paths: string[]): Promise<number>;
  pruneOlderThan(prefix: string, olderThanDays: number): Promise<number>;
}

/**
 * Supabase Storage-backed data lake. Replaces the previous S3 implementation
 * so the project no longer depends on AWS. Uses the service-role key so the
 * server can write/read freely without RLS interference.
 */
export class SupabaseStorageDataLake implements DataLakeProvider {
  private client: SupabaseClient | null = null;
  private bucketName: string;
  private bucketReady = false;
  private initPromise: Promise<boolean> | null = null;

  constructor() {
    this.bucketName = process.env.DATA_LAKE_BUCKET || "sainte-data-lake";

    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (url && key) {
      this.client = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      console.log("DataLake: Supabase Storage configured");
    } else {
      console.warn("DataLake: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — data lake disabled");
    }
  }

  async ensureBucket(): Promise<boolean> {
    if (this.bucketReady) return true;
    if (!this.client) return false;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._ensureBucket();
    return this.initPromise;
  }

  private async _ensureBucket(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const { data: buckets, error: listErr } = await this.client.storage.listBuckets();
      if (listErr) {
        console.warn("DataLake: failed to list buckets:", listErr.message);
        return false;
      }
      const exists = (buckets || []).some((b) => b.name === this.bucketName);
      if (exists) {
        this.bucketReady = true;
        console.log(`DataLake: bucket ${this.bucketName} ready`);
        return true;
      }
      const { error: createErr } = await this.client.storage.createBucket(this.bucketName, {
        public: false,
      });
      if (createErr) {
        console.warn(`DataLake: failed to create bucket ${this.bucketName}:`, createErr.message);
        return false;
      }
      this.bucketReady = true;
      console.log(`DataLake: created bucket ${this.bucketName}`);
      return true;
    } catch (err) {
      console.warn("DataLake: ensureBucket error:", err instanceof Error ? err.message : String(err));
      return false;
    }
  }

  async storeAnalytics(category: string, data: Record<string, any>): Promise<string | null> {
    if (!this.client) return null;
    await this.ensureBucket();
    if (!this.bucketReady) return null;

    try {
      const date = new Date();
      const key = `analytics/${category}/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${Date.now()}.json`;
      const body = new Blob([JSON.stringify(data)], { type: "application/json" });
      const { error } = await this.client.storage.from(this.bucketName).upload(key, body, {
        contentType: "application/json",
        upsert: false,
      });
      if (error) return null;
      return key;
    } catch {
      return null;
    }
  }

  async storeReport(reportType: string, content: string, format: "json" | "csv" = "json"): Promise<string | null> {
    if (!this.client) return null;
    await this.ensureBucket();
    if (!this.bucketReady) return null;

    try {
      const date = new Date();
      const contentType = format === "json" ? "application/json" : "text/csv";
      const key = `reports/${reportType}/${date.toISOString().split("T")[0]}_${Date.now()}.${format}`;
      const body = new Blob([content], { type: contentType });
      const { error } = await this.client.storage.from(this.bucketName).upload(key, body, {
        contentType,
        upsert: false,
      });
      if (error) return null;
      return key;
    } catch {
      return null;
    }
  }

  async listFiles(prefix: string, limit: number = 100): Promise<{ name: string; id: string; createdAt: Date | null }[]> {
    if (!this.client) return [];
    try {
      const { data, error } = await this.client.storage
        .from(this.bucketName)
        .list(prefix, { limit, sortBy: { column: "created_at", order: "desc" } });
      if (error || !data) return [];
      return data.map((item) => ({
        name: item.name,
        id: prefix ? `${prefix}/${item.name}` : item.name,
        createdAt: item.created_at ? new Date(item.created_at) : null,
      }));
    } catch {
      return [];
    }
  }

  async getFile(path: string): Promise<DataLakeFile | null> {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client.storage.from(this.bucketName).download(path);
      if (error || !data) return null;
      const buf = Buffer.from(await data.arrayBuffer());
      return {
        data: buf,
        contentType: (data as Blob).type || "application/octet-stream",
        size: buf.length,
      };
    } catch (err) {
      console.error("DataLake: getFile failed", path, err);
      return null;
    }
  }

  async getFileStream(path: string): Promise<NodeJS.ReadableStream | null> {
    // Supabase Storage's JS client returns a Blob, not a stream. For our
    // analytics use-case (small JSON/CSV reports) the buffered path is fine.
    const file = await this.getFile(path);
    if (!file) return null;
    const { Readable } = await import("stream");
    return Readable.from(file.data);
  }

  async deleteFiles(paths: string[]): Promise<number> {
    if (!this.client || paths.length === 0) return 0;
    try {
      const { data, error } = await this.client.storage.from(this.bucketName).remove(paths);
      if (error) {
        console.warn("DataLake: deleteFiles error:", error.message);
        return 0;
      }
      return Array.isArray(data) ? data.length : 0;
    } catch (err) {
      console.warn("DataLake: deleteFiles threw:", err instanceof Error ? err.message : String(err));
      return 0;
    }
  }

  /**
   * Walk the date-partitioned subtree at `prefix` (e.g. "analytics") and
   * delete every file last touched more than `olderThanDays` ago. Returns
   * the count of removed objects. Used by the retention worker.
   */
  async pruneOlderThan(prefix: string, olderThanDays: number): Promise<number> {
    if (!this.client || olderThanDays <= 0) return 0;
    await this.ensureBucket();
    if (!this.bucketReady) return 0;

    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const toRemove: string[] = [];

    // Two-level walk: prefix → category → year → month → day. We don't
    // fully recurse — instead we trust the existing date partitioning and
    // walk via path math. Anything we can't categorize, we skip.
    const categories = await this.listFiles(prefix, 100);
    for (const cat of categories) {
      // Each "category" entry is itself a folder; list its contents.
      const childPrefix = `${prefix}/${cat.name}`;
      // listFiles may return up to 1000 children for a flat folder; for the
      // date-partitioned analytics tree we just look at leaf files.
      const leaves = await this.listLeaves(childPrefix, 1000);
      for (const leaf of leaves) {
        if (leaf.createdAt && leaf.createdAt.getTime() < cutoff) {
          toRemove.push(leaf.id);
        }
      }
    }

    if (toRemove.length === 0) return 0;
    // Supabase remove() accepts up to 1000 paths per call — chunk to be safe.
    let removed = 0;
    const CHUNK = 500;
    for (let i = 0; i < toRemove.length; i += CHUNK) {
      removed += await this.deleteFiles(toRemove.slice(i, i + CHUNK));
    }
    return removed;
  }

  /**
   * Recursively list every leaf file under `prefix`. Used by pruneOlderThan
   * to find date-partitioned analytics/reports objects that are stale.
   */
  private async listLeaves(prefix: string, perCall: number): Promise<{ name: string; id: string; createdAt: Date | null }[]> {
    if (!this.client) return [];
    const out: { name: string; id: string; createdAt: Date | null }[] = [];
    const stack: string[] = [prefix];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      const { data, error } = await this.client.storage
        .from(this.bucketName)
        .list(cur, { limit: perCall });
      if (error || !data) continue;
      for (const item of data) {
        const fullPath = `${cur}/${item.name}`;
        // Supabase marks folders with a null id; files have an id + created_at.
        if (item.id) {
          out.push({
            name: item.name,
            id: fullPath,
            createdAt: item.created_at ? new Date(item.created_at) : null,
          });
        } else {
          stack.push(fullPath);
        }
      }
    }
    return out;
  }
}

export class NoOpDataLake implements DataLakeProvider {
  async ensureBucket(): Promise<boolean> { return false; }
  async storeAnalytics(): Promise<string | null> { return null; }
  async storeReport(): Promise<string | null> { return null; }
  async listFiles(): Promise<{ name: string; id: string; createdAt: Date | null }[]> { return []; }
  async getFile(): Promise<DataLakeFile | null> { return null; }
  async getFileStream(): Promise<NodeJS.ReadableStream | null> { return null; }
  async deleteFiles(): Promise<number> { return 0; }
  async pruneOlderThan(): Promise<number> { return 0; }
}

const _supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
export const dataLake: DataLakeProvider =
  _supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? new SupabaseStorageDataLake()
    : new NoOpDataLake();
