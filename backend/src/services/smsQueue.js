/**
 * SMS Queue Service
 * 
 * Solves the problem of sending 10,000+ SMS messages simultaneously.
 * Instead of firing all at once, this service queues them and processes
 * in controlled batches with delays between each batch.
 * 
 * - Batch size: 10 SMS per batch (lowered for Golis rate limiting)
 * - Delay between batches: 2000ms (2 seconds - safe for Golis gateway)
 * - Fully non-blocking (fire-and-forget from routes)
 * - Duplicate-safe (won't queue the same exact message to the same phone twice per job)
 * - Progress tracking: exposes sent/failed counts for real-time monitoring
 */

const { sendSMS } = require('./smsService');

// GOLIS RATE LIMITING FIX:
// Golis gateway rejects/drops SMS when too many arrive simultaneously.
// 10 per batch with 2s delay = safe throughput without triggering rate limits.
// 3000 students = 300 batches x ~2s = ~10 mins background processing (reliable).
const BATCH_SIZE = 10;        // Lowered from 50 -- avoids Golis rate limiting
const BATCH_DELAY_MS = 2000;  // Increased from 500ms -- 2s gap between batches

// Queue state
let isProcessing = false;
const pendingQueue = [];

// Progress tracking -- resets each time a new bulk job starts
let stats = {
    totalQueued: 0,
    totalSent: 0,
    totalFailed: 0,
    startedAt: null,
    completedAt: null,
};

/**
 * Sleep helper
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Process the queue in controlled batches.
 * This runs in the background and never blocks the HTTP response.
 */
async function processQueue() {
    if (isProcessing) return; // Already running
    isProcessing = true;
    stats.startedAt = new Date().toISOString();
    stats.completedAt = null;

    console.log(`[SMSQueue] Starting queue processing. Total pending: ${pendingQueue.length}`);

    while (pendingQueue.length > 0) {
        // Pull next batch
        const batch = pendingQueue.splice(0, BATCH_SIZE);

        console.log(`[SMSQueue] Processing batch of ${batch.length}. Remaining: ${pendingQueue.length}`);

        // Send all in the batch concurrently (within the batch)
        const results = await Promise.allSettled(
            batch.map(item =>
                sendSMS(item.phone, item.message, {
                    schoolId: item.schoolId,
                    studentId: item.studentId,
                    type: item.type
                }).catch(err => {
                    console.error(`[SMSQueue] Failed for ${item.phone} (${item.studentName}):`, err.message);
                    return { success: false };
                })
            )
        );

        let batchSent = 0;
        let batchFailed = 0;
        for (const r of results) {
            if (r.status === 'fulfilled' && r.value && r.value.success === true) {
                batchSent++;
                stats.totalSent++;
            } else {
                batchFailed++;
                stats.totalFailed++;
            }
        }

        console.log(`[SMSQueue] Batch done. Sent: ${batchSent}, Failed: ${batchFailed} | Total -> Sent: ${stats.totalSent}, Failed: ${stats.totalFailed}, Remaining: ${pendingQueue.length}`);

        // Wait before the next batch to avoid rate-limiting
        if (pendingQueue.length > 0) {
            await sleep(BATCH_DELAY_MS);
        }
    }

    isProcessing = false;
    stats.completedAt = new Date().toISOString();
    console.log(`[SMSQueue] Queue processing complete. Total Sent: ${stats.totalSent}, Failed: ${stats.totalFailed}`);
}

/**
 * Add a single SMS to the queue.
 * @param {string} phone - Recipient phone number
 * @param {string} message - SMS message text
 * @param {Object} options - { schoolId, studentId, type, studentName }
 */
function enqueueSMS(phone, message, options = {}) {
    if (!phone || !message) return;

    pendingQueue.push({
        phone,
        message,
        schoolId: options.schoolId || null,
        studentId: options.studentId || null,
        type: options.type || 'general',
        studentName: options.studentName || 'Unknown'
    });
    stats.totalQueued++;
}

/**
 * Add multiple SMS jobs to the queue at once, then kick off processing.
 * This is the main entry point for bulk SMS operations (attendance, exam results).
 * 
 * @param {Array} jobs - Array of { phone, message, schoolId, studentId, type, studentName }
 */
function enqueueBulkSMS(jobs = []) {
    if (!jobs || jobs.length === 0) return;

    // Reset stats for new bulk job if queue was idle
    if (pendingQueue.length === 0 && !isProcessing) {
        stats = { totalQueued: 0, totalSent: 0, totalFailed: 0, startedAt: null, completedAt: null };
    }

    // Deduplicate within this bulk job to avoid sending the exact same message twice to one person.
    // This ensures siblings get separate messages, and different alerts (exam vs attendance)
    // to the same parent are not skipped.
    const seen = new Set();
    let added = 0;

    for (const job of jobs) {
        if (!job.phone || !job.message) continue;
        
        const dedupeKey = `${job.phone}:${job.studentId || ''}:${job.message}`;
        if (seen.has(dedupeKey)) continue; 
        seen.add(dedupeKey);

        pendingQueue.push({
            phone: job.phone,
            message: job.message,
            schoolId: job.schoolId || null,
            studentId: job.studentId || null,
            type: job.type || 'general',
            studentName: job.studentName || 'Unknown'
        });
        stats.totalQueued++;
        added++;
    }

    console.log(`[SMSQueue] Enqueued ${added} SMS jobs (${jobs.length - added} duplicates skipped). Queue size: ${pendingQueue.length}`);

    // Start processing in background (non-blocking)
    setImmediate(() => processQueue());
}

/**
 * Get current queue stats -- useful for real-time progress monitoring.
 * Call GET /api/sms/queue-stats to poll progress during a bulk send.
 */
function getQueueStats() {
    const total = stats.totalQueued;
    const processed = stats.totalSent + stats.totalFailed;
    const progressPct = total > 0 ? Math.round((processed / total) * 100) : 0;

    return {
        pending: pendingQueue.length,
        isProcessing,
        totalQueued: stats.totalQueued,
        totalSent: stats.totalSent,
        totalFailed: stats.totalFailed,
        progressPercent: progressPct,
        startedAt: stats.startedAt,
        completedAt: stats.completedAt,
    };
}

module.exports = { enqueueSMS, enqueueBulkSMS, getQueueStats };
