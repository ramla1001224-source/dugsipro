require('dotenv').config();

process.on('uncaughtException', async (err) => {
    console.error('[CRITICAL] Uncaught Exception:', err.stack || err);
    try {
        const { logError } = require('./services/errorLoggerService');
        await logError({ message: err.message, stack: err.stack, source: 'uncaught_exception' });
    } catch (e) {}
    process.exit(1);
});
process.on('unhandledRejection', async (reason, promise) => {
    console.error('[CRITICAL] Unhandled Rejection:', reason?.stack || reason);
    try {
        const { logError } = require('./services/errorLoggerService');
        await logError({ 
            message: reason?.message || String(reason), 
            stack: reason?.stack, 
            source: 'unhandled_rejection' 
        });
    } catch (e) {}
    process.exit(1);
});

console.log('[DEBUG] App starting in production mode...');
console.log('[DEBUG] Node version:', process.version);
console.log('[DEBUG] Expected PORT:', process.env.PORT);
const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const prisma = require('./prisma');

// Import all routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const studentRoutes = require('./routes/students');
const teacherRoutes = require('./routes/teachers');
const attendanceRoutes = require('./routes/attendance');
const paymentRoutes = require('./routes/payments');
const paymentGatewayRoutes = require('./routes/payment-gateways'); // New Mobile Money Route
const classRoutes = require('./routes/classes');
const expenseRoutes = require('./routes/expenses');
const gradeRoutes = require('./routes/grades');
const subjectRoutes = require('./routes/subjects');
const dashboardRoutes = require('./routes/dashboard'); // New
const timetableRoutes = require('./routes/timetable');
const examRoutes = require('./routes/exams');
const announcementRoutes = require('./routes/announcements');
const messageRoutes = require('./routes/messages');
const transportRoutes = require('./routes/transport');
const parentRoutes = require('./routes/parents');
const salaryRoutes = require('./routes/salary');
const staffRoutes = require('./routes/staff');
const leaveRoutes = require('./routes/leaves');
const academicYearRoutes = require('./routes/academicYears');
const settingsRoutes = require('./routes/settings');
const feeRoutes = require('./routes/fees');
const notificationRoutes = require('./routes/notifications');
const schoolRoutes = require('./routes/schools');
const eventRoutes = require('./routes/events');
const ownerRoutes = require('./routes/owner');


const homeworkRoutes = require('./routes/homework');
const virtualClassRoutes = require('./routes/virtualClasses');
const submissionRoutes = require('./routes/submissions');
const backupRoutes = require('./routes/backup');
const libraryRoutes = require('./routes/library');
const elearningRoutes = require('./routes/elearning'); // New E-Learning Routes
const smsRoutes = require('./routes/sms');

const syncRoutes = require('./routes/sync');
const sectionsRoutes = require('./routes/sections'); // New
// const aiRoutes = require('./routes/ai');
const reportRoutes = require('./routes/reports');
const lessonsRoutes = require('./routes/lessons'); // New

const app = express();

// Trust reverse proxy (Railway) for rate-limiting to fix ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
app.set('trust proxy', 1);

// Compress all responses (reduces bandwidth ~70%)
app.use(compression());

app.use(cors({ origin: '*' }));

// Rate limiting — 200 requests per minute per IP
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests. Please slow down.' },
    skip: (req) => req.path === '/healthz', // never rate-limit health checks
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
    if (req.url.includes('/api/dashboard')) {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    }

    next();
});

// Serve static files from uploads folder (Kept for backwards compatibility with legacy local uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Error handler middleware
const errorHandler = async (err, req, res, next) => {
    console.error(err.stack);
    
    try {
        const { logError } = require('./services/errorLoggerService');
        await logError({
            message: err.message,
            stack: err.stack,
            source: 'api',
            path: req.originalUrl,
            method: req.method
        });
    } catch (e) {
        console.error('[ErrorLogger] Failed to log API error:', e.message);
    }

    res.status(500).json({ message: 'Internal server error' });
};

// Health check for Railway / Production
app.get('/', (req, res) => res.status(200).send('Dugsi Pro API is running'));
app.get('/healthz', (req, res) => {
    const mem = process.memoryUsage();
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        memory: {
            rss: `${Math.round(mem.rss / 1024 / 1024)} MB`,
            heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)} MB`,
            heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)} MB`,
        }
    });
});

// Mount all routes
const adsRoutes = require('./routes/ads');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/payment-gateways', paymentGatewayRoutes); // New Mobile Money Gateway Settings Route
app.use('/api/classes', classRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/grades', gradeRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/dashboard', dashboardRoutes); // New
app.use('/api/exams', examRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/transport', transportRoutes);
app.use('/api/parents', parentRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/academic-years', academicYearRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/ads', adsRoutes);

app.use('/api/homework', homeworkRoutes);
app.use('/api/virtual-classes', virtualClassRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/elearning', elearningRoutes); // New E-Learning routes for quizzes and lessons

app.use('/api/sync', syncRoutes);
app.use('/api/sections', sectionsRoutes); // New
// app.use('/api/ai', aiRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/lessons', lessonsRoutes); // New
app.use('/api/sms', smsRoutes);
app.use('/api/seed', require('./routes/seed'));

console.log('[DEBUG] Error handler middleware mounted');
app.use(errorHandler);

const startFeeReminderJob = require('./jobs/feeReminder');
console.log('[DEBUG] Starting fee reminder job scheduler...');
try {
    startFeeReminderJob();
    console.log('[DEBUG] Fee reminder job scheduled successfully');
} catch (e) {
    console.error('[DEBUG] Failed to start fee reminder job:', e);
}

const startBackupJob = require('./jobs/backupJob');
const { performBackup } = require('./services/backupService');
console.log('[DEBUG] Starting Google Drive backup job scheduler...');
try {
    startBackupJob();
    console.log('[DEBUG] Google Drive backup job scheduled successfully');
} catch (e) {
    console.error('[DEBUG] Failed to start backup job:', e);
}


const PORT = process.env.PORT || 4001;
console.log(`[DEBUG] Final PORT check: ${PORT}`);
console.log(`[DEBUG] Attempting to listen on 0.0.0.0:${PORT}...`);

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n================================================`);
    console.log(`[Dugsi Pro System] API IS LIVE ON PORT ${PORT}`);
    console.log(`================================================\n`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`[CRITICAL] Port ${PORT} is already in use. Retrying...`);
        // On Railway, this is usually a sign of a zombie process or a misconfiguration.
        process.exit(1);
    } else {
        console.error('[CRITICAL] Server failed to start:', err);
        process.exit(1);
    }
});

// Keep-alive tuning for 10k concurrent users
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// ─── Memory Usage Logger (every 2 minutes) ───────────────────────────────────
// Logs RAM so you can monitor trends in PM2 logs before hitting the 2GB limit.
setInterval(() => {
    const mem = process.memoryUsage();
    const rss  = Math.round(mem.rss  / 1024 / 1024);
    const heap = Math.round(mem.heapUsed / 1024 / 1024);
    console.log(`[MEMORY] RSS: ${rss} MB | Heap: ${heap} MB`);

    // Failure-safe: Gracefully restart if memory exceeds 2GB
    if (rss > 2048) {
        console.error(`[MEMORY ALERT] RSS (${rss} MB) exceeded 2GB limit. Restarting...`);
        const { logError } = require('./services/errorLoggerService');
        logError({ 
            message: `Memory limit exceeded: ${rss} MB`, 
            source: 'memory_alert' 
        }).then(() => process.emit('SIGINT'));
    }

    // Trigger V8 garbage collection manually if --expose-gc flag is present
    if (typeof global.gc === 'function') global.gc();
}, 2 * 60 * 1000).unref(); // .unref() so this timer never blocks process exit

// ─── Graceful Shutdown for PM2 ────────────────────────────────────────────────
// PM2 sends SIGINT when it wants to restart (e.g. max_memory_restart hit).
// We stop accepting new connections, wait for in-flight requests to finish,
// then disconnect Prisma cleanly before exiting.
const gracefulShutdown = (signal) => {
    console.log(`[PM2] Received ${signal}. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(async () => {
        console.log('[PM2] HTTP server closed. Disconnecting database...');
        try {
            await prisma.$disconnect();
            console.log('[PM2] Database disconnected. Exiting cleanly.');
        } catch (err) {
            console.error('[PM2] Error disconnecting database:', err);
        } finally {
            process.exit(0);
        }
    });

    // Force-exit after 8 seconds if requests are still hanging
    setTimeout(() => {
        console.warn('[PM2] Graceful shutdown timed out. Forcing exit.');
        process.exit(1);
    }, 8000).unref();
};

process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
