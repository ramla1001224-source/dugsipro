const prisma = require('../prisma');

/**
 * Logs a system error to the database for the owner dashboard.
 */
const logError = async ({ message, stack, source, path, method }) => {
    try {
        await prisma.systemError.create({
            data: {
                message: message || 'Unknown Error',
                stack: stack || null,
                source: source || 'api',
                path: path || null,
                method: method || null
            }
        });
        console.log(`[ErrorLogger] Logged error to DB: ${message}`);
    } catch (err) {
        // Fallback to console if DB fails (e.g. database connection lost)
        console.error('[ErrorLogger] Failed to log error to DB:', err.message);
    }
};

module.exports = { logError };
