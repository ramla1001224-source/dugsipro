module.exports = {
  apps: [
    {
      name: 'smartschool-backend',
      script: './src/index.js',

      // ─── Instance Configuration ───────────────────────────────────────────
      instances: 1,
      exec_mode: 'fork', // 'fork' is safer for single-instance with memory limits

      // ─── Memory Leak Protection ───────────────────────────────────────────
      // PM2 will AUTO-RESTART the process if it exceeds 2GB RAM
      max_memory_restart: '2G',

      // Node.js V8 heap limit set slightly below 2GB
      node_args: '--max-old-space-size=1900 --expose-gc',

      // ─── Restart Behaviour ────────────────────────────────────────────────
      autorestart: true,

      // Minimum time the app must be UP before a crash-restart is counted.
      // If the app dies before this, PM2 treats it as a crash loop.
      min_uptime: '10s',

      // Maximum number of times PM2 will restart the app within a time window
      // before giving up (prevents infinite crash loops burning resources).
      max_restarts: 10,

      // Exponential backoff delay between restarts (ms).
      // First restart: 100ms, then doubles each time up to 5 minutes.
      // This prevents CPU thrashing during repeated crash loops.
      exp_backoff_restart_delay: 100,

      // Wait this long (ms) before restarting after a crash
      restart_delay: 2000,

      // ─── Graceful Shutdown ────────────────────────────────────────────────
      // How long PM2 waits (ms) for the app to handle in-flight requests
      // before force-killing it during a restart
      kill_timeout: 5000,

      // ─── Environment Variables ────────────────────────────────────────────
      env: {
        NODE_ENV: 'production',
        UV_THREADPOOL_SIZE: 4, // Limit libuv thread pool to save memory
      },
      env_development: {
        NODE_ENV: 'development',
      },

      // ─── Logging ─────────────────────────────────────────────────────────
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,

      // Rotate / cap log files so they don't fill the disk
      // (requires: pm2 install pm2-logrotate)
      log_type: 'json',

      // ─── Misc ─────────────────────────────────────────────────────────────
      watch: false,           // Never watch in production
      ignore_watch: ['node_modules', 'logs', 'uploads'],
      source_map_support: false,
    },
  ],
};
