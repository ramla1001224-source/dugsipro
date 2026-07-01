/**
 * Upstash Redis cache — shared across ALL cluster workers
 * Falls back to in-memory if Redis env vars are not set
 */
const { Redis } = require('@upstash/redis');

// In-memory fallback
const memStore = new Map();
const mem = {
    get: (k) => {
        const e = memStore.get(k);
        if (!e) return null;
        if (Date.now() > e.exp) { memStore.delete(k); return null; }
        return e.val;
    },
    set: (k, v, ttlMs) => memStore.set(k, { val: v, exp: Date.now() + ttlMs }),
    del: (k) => memStore.delete(k),
};

let redis = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    console.log('[Cache] Upstash Redis connected');
} else {
    console.log('[Cache] Using in-memory fallback (set UPSTASH_REDIS_REST_URL + TOKEN for Redis)');
}

async function get(key) {
    try {
        if (redis) {
            const val = await redis.get(key);
            return val ?? null;
        }
        return mem.get(key);
    } catch (e) {
        console.error('[Cache] Upstash GET Error:', e.message, '- Disabling Redis to prevent hanging.');
        redis = null; // Disable on auth failure or network timeout
        return mem.get(key);
    }
}

async function set(key, value, ttlMs = 30000) {
    try {
        if (redis) {
            await redis.set(key, value, { px: ttlMs }); // px = milliseconds TTL
        }
        mem.set(key, value, ttlMs); // also keep in local mem for speed
    } catch (e) {
        console.error('[Cache] Upstash SET Error:', e.message, '- Disabling Redis to prevent hanging.');
        redis = null;
        mem.set(key, value, ttlMs);
    }
}

async function del(key) {
    try {
        if (redis) await redis.del(key);
        mem.del(key);
    } catch (e) {
        mem.del(key);
    }
}

async function delByPrefix(prefix) {
    try {
        if (redis) {
            const keys = await redis.keys(`${prefix}*`);
            if (keys.length > 0) await redis.del(...keys);
        }
        for (const k of memStore.keys()) {
            if (k.startsWith(prefix)) memStore.delete(k);
        }
    } catch (e) {
        for (const k of memStore.keys()) {
            if (k.startsWith(prefix)) memStore.delete(k);
        }
    }
}

// Background cleanup: every 5 minutes, scan and remove expired keys
setInterval(() => {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of memStore.entries()) {
        if (now > entry.exp) {
            memStore.delete(key);
            count++;
        }
    }
    if (count > 0) {
        console.log(`[Cache GC] Pruned ${count} expired keys from memory.`);
    }
}, 5 * 60 * 1000).unref(); // .unref() ensures this timer doesn't block process exit

module.exports = { get, set, del, delByPrefix };
