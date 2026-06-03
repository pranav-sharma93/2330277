const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'db.json');

// Ensure database file exists with initial structure
function initDb() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ notifications: [] }, null, 2), 'utf8');
  }
}

/**
 * Read the entire database file
 * @returns {Object} { notifications: Array }
 */
function readDb() {
  initDb();
  try {
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to read database, returning empty dataset:', err);
    return { notifications: [] };
  }
}

/**
 * Write updated data to the database file
 * @param {Object} data - { notifications: Array }
 */
function writeDb(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write to database:', err);
  }
}

module.exports = {
  readDb,
  writeDb
};
