/**
 * SMS Queue Service
 * 
 * Solves the problem of sending 10,000+ SMS messages simultaneously.
 * Instead of firing all at once, this service queues them and processes
 * in controlled batches with delays between each batch.
 * 
 * - Batch size: 50 SMS per batch
 * - Delay between batches: 500ms
 * - Fully non-blocking (fire-and-forget from routes)
 * - Duplicate-safe (won't queue the same exact message to the same phone twice per job)
 */

const { sendSMS } = require('./smsService');

const BATCH_SIZE = 50;       // How many SMS per batch
const BATCH_DELAY_MS = 500;  // Milliseconds to wait between batches

// Simple in-memory queue state (per process)
let isProcessing = false;
const pendingQueue = [];

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
                })
            )
        );

        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        console.log(`[SMSQueue] Batch done. Success: ${succeeded}, Failed: ${failed}`);

        // Wait before the next batch to avoid rate-limiting
        if (pendingQueue.length > 0) {
            await sleep(BATCH_DELAY_MS);
        }
    }

    isProcessing = false;
    console.log(`[SMSQueue] Queue processing complete.`);
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
}

/**
 * Add multiple SMS jobs to the queue at once, then kick off processing.
 * This is the main entry point for bulk SMS operations (attendance, exam results).
 * 
 * @param {Array} jobs - Array of { phone, message, schoolId, studentId, type, studentName }
 */
function enqueueBulkSMS(jobs = []) {
    if (!jobs || jobs.length === 0) return;

    // Deduplicate within this bulk job to avoid sending the exact same message twice to one person
    const seen = new Set();
    let added = 0;

    for (const job of jobs) {
        if (!job.phone || !job.message) continue;
        
        // Deduplicate by phone, student, and message content
        // This ensures siblings get separate messages, and different alerts (exam vs attendance) 
        // to the same parent are not skipped.
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
        added++;
    }

    console.log(`[SMSQueue] Enqueued ${added} SMS jobs (${jobs.length - added} duplicates skipped). Queue size: ${pendingQueue.length}`);

    // Start processing in background (non-blocking)
    setImmediate(() => processQueue());
}

/**
 * Get current queue stats.
 */
function getQueueStats() {
    return {
        pending: pendingQueue.length,
        isProcessing
    };
}

module.exports = { enqueueSMS, enqueueBulkSMS, getQueueStats };
