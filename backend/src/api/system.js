const express = require('express');
const router = express.Router();
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Get system resource usage
 */
router.get('/status', async (req, res) => {
  try {
    // CPU Information
    const cpus = os.cpus();
    const cpuModel = cpus[0].model;
    const cpuCount = cpus.length;
    
    // Calculate CPU usage
    let totalIdle = 0;
    let totalTick = 0;
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    const cpuUsage = 100 - ~~(100 * totalIdle / totalTick);

    // Memory Information
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;

    // Uptime
    const uptime = os.uptime();

    // Platform info
    const platform = os.platform();
    const hostname = os.hostname();

    // Disk usage (platform-specific)
    let diskUsage = null;
    try {
      if (platform === 'win32') {
        // Windows: Use wmic or Get-Volume
        const { stdout } = await execAsync('powershell -Command "Get-PSDrive C | Select-Object Used,Free | ConvertTo-Json"');
        const drive = JSON.parse(stdout);
        const total = drive.Used + drive.Free;
        diskUsage = {
          total: total,
          used: drive.Used,
          free: drive.Free,
          usagePercent: (drive.Used / total) * 100
        };
      } else {
        // Linux/Unix: Use df
        const { stdout } = await execAsync("df -k / | tail -1 | awk '{print $2,$3,$4}'");
        const [total, used, free] = stdout.trim().split(' ').map(v => parseInt(v) * 1024);
        diskUsage = {
          total,
          used,
          free,
          usagePercent: (used / total) * 100
        };
      }
    } catch (error) {
      console.error('Error getting disk usage:', error);
    }

    res.json({
      status: 'ok',
      system: {
        hostname,
        platform: platform === 'win32' ? 'Windows' : platform === 'linux' ? 'Linux' : platform,
        uptime,
        uptimeFormatted: formatUptime(uptime)
      },
      cpu: {
        model: cpuModel,
        cores: cpuCount,
        usage: Math.round(cpuUsage * 10) / 10,
        loadAverage: os.loadavg()
      },
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        usagePercent: Math.round(memoryUsage * 10) / 10
      },
      disk: diskUsage,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting system status:', error);
    res.status(500).json({
      error: 'Failed to get system status',
      message: error.message
    });
  }
});

/**
 * Format uptime in human-readable format
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / (24 * 3600));
  seconds %= (24 * 3600);
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  
  return parts.join(' ') || '0m';
}

module.exports = router;
