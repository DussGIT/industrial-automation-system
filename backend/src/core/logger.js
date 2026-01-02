const winston = require('winston');
const path = require('path');

const logLevel = process.env.LOG_LEVEL || 'info';

// Custom transport for database logging
class DatabaseTransport extends winston.Transport {
  constructor(opts) {
    super(opts);
  }

  log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    // Only write to database if it's initialized
    try {
      const { getDb } = require('./database');
      const db = getDb();
      
      if (db) {
        const stmt = db.prepare(`
          INSERT INTO system_logs (level, message, service, metadata)
          VALUES (?, ?, ?, ?)
        `);
        
        const metadata = { ...info };
        delete metadata.level;
        delete metadata.message;
        delete metadata.timestamp;
        delete metadata.service;
        delete metadata.siteId;
        
        stmt.run(
          info.level,
          info.message,
          info.service || 'ia-backend',
          Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null
        );
      }
    } catch (error) {
      // Log to console for debugging but don't throw
      console.error('DatabaseTransport error:', error.message);
    }

    callback();
  }
}

const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'ia-backend',
    siteId: process.env.SITE_ID || 'unknown'
  },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ level, message, timestamp, ...metadata }) => {
            let msg = `${timestamp} [${level}]: ${message}`;
            if (Object.keys(metadata).length > 0) {
              msg += ` ${JSON.stringify(metadata)}`;
            }
            return msg;
          }
        )
      )
    }),
    
    // Write all logs to database
    new DatabaseTransport({ level: logLevel }),
    
    // Write all logs to file
    new winston.transports.File({
      filename: path.join(process.env.LOG_FILE || './logs/automation.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Write errors to separate file
    new winston.transports.File({
      filename: path.join('./logs/error.log'),
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5,
      tailable: true
    })
  ]
});

module.exports = logger;
