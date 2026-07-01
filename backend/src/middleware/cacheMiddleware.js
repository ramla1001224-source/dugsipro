/**
 * Cache middleware — wraps any GET route with Redis caching
 * Usage: router.get('/path', cacheMiddleware(30), handler)
 * ttlSeconds: how long to cache (default 30s)
 */
const cache = require('../lib/cache');

function cacheMiddleware(ttlSeconds = 30) {
    return async (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') return next();

        const schoolId = req.user?.schoolId || req.query.schoolId || 'global';
        const userId = req.user?.id || 'anon';
        const queryStr = JSON.stringify(req.query);
        const key = `route:${req.baseUrl}${req.path}:${schoolId}:${userId}:${queryStr}`;

        try {
            const cached = await cache.get(key);
            if (cached) {
                res.setHeader('X-Cache', 'HIT');
                return res.json(cached);
            }
        } catch (_) {}

        // Intercept res.json to store result in cache
        const originalJson = res.json.bind(res);
        res.json = async (data) => {
            try {
                if (res.statusCode === 200) {
                    await cache.set(key, data, ttlSeconds * 1000);
                }
            } catch (_) {}
            res.setHeader('X-Cache', 'MISS');
            return originalJson(data);
        };

        next();
    };
}

module.exports = cacheMiddleware;
