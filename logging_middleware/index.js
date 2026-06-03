const fs = require('fs');
const path = require('path');

/**
 * Custom logging middleware for Express
 * @param {Object} options 
 * @param {string} [options.logFilePath] - Absolute path to log file. Defaults to 'app.log' in project root.
 */
function customLogger(options = {}) {
  const logFilePath = options.logFilePath || path.join(process.cwd(), 'app.log');

  // Ensure log directory exists
  const logDir = path.dirname(logFilePath);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  return (req, res, next) => {
    const startTime = process.hrtime();
    // Generate a unique short request ID
    const requestId = Math.random().toString(36).substring(2, 10).toUpperCase();

    // Capture request info
    const method = req.method;
    const url = req.url;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Once request completes, log it
    res.on('finish', () => {
      const duration = process.hrtime(startTime);
      const durationMs = (duration[0] * 1000 + duration[1] / 1e6).toFixed(2);
      const status = res.statusCode;

      // ANSI Colors for console output
      let statusColor = '\x1b[0m'; // Reset
      if (status >= 500) {
        statusColor = '\x1b[31m'; // Red (Error)
      } else if (status >= 400) {
        statusColor = '\x1b[33m'; // Yellow (Client Error)
      } else if (status >= 300) {
        statusColor = '\x1b[36m'; // Cyan (Redirect)
      } else if (status >= 200) {
        statusColor = '\x1b[32m'; // Green (Success)
      }

      const timestamp = new Date().toISOString();
      const methodColor = '\x1b[35m'; // Magenta (Method)
      const resetColor = '\x1b[0m';
      const grayColor = '\x1b[90m';

      // Log colorized output to console
      console.log(
        `${grayColor}[${timestamp}]${resetColor} ${grayColor}[REQ:${requestId}]${resetColor} ${methodColor}${method}${resetColor} ${url} - ${statusColor}${status}${resetColor} - ${durationMs}ms - ${grayColor}${ip}${resetColor}`
      );

      // Construct a structured log entry for the file
      const logEntry = {
        timestamp,
        requestId,
        method,
        url,
        status,
        durationMs: parseFloat(durationMs),
        ip,
        userAgent
      };

      try {
        fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + '\n', 'utf8');
      } catch (err) {
        console.error('Failed to write request log to file:', err);
      }
    });

    next();
  };
}

module.exports = customLogger;
