// PM2 Ecosystem Config — sgsland-nextjs
// Usage: pm2 start ecosystem.config.js --env production

module.exports = {
  apps: [
    {
      name: "sgsland-nextjs",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/var/www/sgsland-nextjs",
      instances: "max",          // cluster mode — 1 per CPU core
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "development",
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
        NEXT_PUBLIC_API_URL: "https://sgsland.vn",
        NEXTAUTH_URL: "https://sgsland.vn",
        // NEXTAUTH_SECRET: set via .env.local on server
      },
      error_file: "/var/log/pm2/sgsland-nextjs-error.log",
      out_file: "/var/log/pm2/sgsland-nextjs-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
    },
  ],
};
