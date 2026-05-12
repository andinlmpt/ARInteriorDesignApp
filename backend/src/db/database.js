/**
 * Database module using in-memory storage
 * Simple JSON-based storage solution (no native dependencies!)
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// In-memory database storage
const storage = {
  users: new Map(),
  projects: new Map(),
  layouts: new Map(),
  theme_recommendations: new Map(),
};

// Data directory for persistence (optional)
const dataDir = join(__dirname, '../../data');
const dataFile = join(dataDir, 'db.json');

/**
 * Initialize database
 */
export function initDatabase() {
  console.log('[Database] Initializing in-memory database...');
  
  // Try to load existing data from file
  try {
    if (existsSync(dataFile)) {
      const data = JSON.parse(readFileSync(dataFile, 'utf-8'));
      if (data.users) storage.users = new Map(Object.entries(data.users));
      if (data.projects) storage.projects = new Map(Object.entries(data.projects));
      if (data.layouts) storage.layouts = new Map(Object.entries(data.layouts));
      if (data.theme_recommendations) storage.theme_recommendations = new Map(Object.entries(data.theme_recommendations));
      console.log('[Database] Loaded existing data from file');
    }
  } catch (error) {
    console.warn('[Database] Could not load existing data:', error.message);
  }

  console.log('[Database] ✅ Initialized successfully (in-memory mode)');
  return createDbInterface();
}

/**
 * Save database to file (for persistence)
 */
function saveToFile() {
  try {
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    const data = {
      users: Object.fromEntries(storage.users),
      projects: Object.fromEntries(storage.projects),
      layouts: Object.fromEntries(storage.layouts),
      theme_recommendations: Object.fromEntries(storage.theme_recommendations),
    };
    writeFileSync(dataFile, JSON.stringify(data, null, 2));
  } catch (error) {
    console.warn('[Database] Could not save to file:', error.message);
  }
}

/**
 * Create a database interface that mimics better-sqlite3 API
 */
function createDbInterface() {
  return {
    // Prepare a statement (simplified)
    prepare(sql) {
      return {
        run(...params) {
          // Parse INSERT/UPDATE/DELETE
          const insertMatch = sql.match(/INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+(\w+)/i);
          if (insertMatch) {
            const table = insertMatch[1];
            const id = params[0] || `id_${Date.now()}`;
            const data = { id, ...this.parseValues(sql, params) };
            storage[table]?.set(id, data);
            saveToFile();
            return { changes: 1 };
          }
          
          const updateMatch = sql.match(/UPDATE\s+(\w+)/i);
          if (updateMatch) {
            const table = updateMatch[1];
            const id = params[params.length - 1]; // Assume last param is ID for WHERE
            if (storage[table]?.has(id)) {
              const existing = storage[table].get(id);
              storage[table].set(id, { ...existing, ...this.parseValues(sql, params) });
              saveToFile();
              return { changes: 1 };
            }
            return { changes: 0 };
          }
          
          const deleteMatch = sql.match(/DELETE\s+FROM\s+(\w+)/i);
          if (deleteMatch) {
            const table = deleteMatch[1];
            const id = params[0];
            const existed = storage[table]?.delete(id);
            saveToFile();
            return { changes: existed ? 1 : 0 };
          }
          
          return { changes: 0 };
        },
        
        get(...params) {
          const selectMatch = sql.match(/SELECT\s+.+\s+FROM\s+(\w+)/i);
          if (selectMatch) {
            const table = selectMatch[1];
            
            // Check for WHERE clause with id or other field
            if (sql.includes('WHERE')) {
              const id = params[0];
              
              // For api_key lookup
              if (sql.includes('api_key')) {
                for (const [key, value] of storage[table]?.entries() || []) {
                  if (value.api_key === id) return value;
                }
                return undefined;
              }
              
              // For email lookup
              if (sql.includes('email')) {
                for (const [key, value] of storage[table]?.entries() || []) {
                  if (value.email === id) return value;
                }
                return undefined;
              }
              
              return storage[table]?.get(id);
            }
            
            // No WHERE - return first
            const iterator = storage[table]?.values();
            return iterator?.next()?.value;
          }
          return undefined;
        },
        
        all(...params) {
          const selectMatch = sql.match(/SELECT\s+.+\s+FROM\s+(\w+)/i);
          if (selectMatch) {
            const table = selectMatch[1];
            let results = Array.from(storage[table]?.values() || []);
            
            // Simple WHERE filtering
            if (sql.includes('WHERE') && params.length > 0) {
              const field = sql.match(/WHERE\s+(\w+)\s*=/i)?.[1];
              if (field) {
                results = results.filter(r => r[field] === params[0]);
              }
            }
            
            // Handle ORDER BY
            if (sql.includes('ORDER BY')) {
              const orderMatch = sql.match(/ORDER BY\s+(\w+)\s*(DESC|ASC)?/i);
              if (orderMatch) {
                const field = orderMatch[1];
                const desc = orderMatch[2]?.toUpperCase() === 'DESC';
                results.sort((a, b) => {
                  if (desc) return (b[field] || 0) - (a[field] || 0);
                  return (a[field] || 0) - (b[field] || 0);
                });
              }
            }
            
            // Handle LIMIT
            const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
            if (limitMatch) {
              results = results.slice(0, parseInt(limitMatch[1]));
            }
            
            return results;
          }
          return [];
        },
        
        parseValues(sql, params) {
          // Extract column names from INSERT
          const colMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
          if (colMatch) {
            const cols = colMatch[1].split(',').map(c => c.trim());
            const obj = {};
            cols.forEach((col, i) => {
              if (params[i] !== undefined) obj[col] = params[i];
            });
            return obj;
          }
          
          // Extract from SET clause for UPDATE
          const setMatch = sql.match(/SET\s+(.+)\s+WHERE/i);
          if (setMatch) {
            const parts = setMatch[1].split(',');
            const obj = {};
            parts.forEach((part, i) => {
              const col = part.split('=')[0].trim();
              if (params[i] !== undefined) obj[col] = params[i];
            });
            return obj;
          }
          
          return {};
        }
      };
    },
    
    // Execute raw SQL (for CREATE TABLE, etc.)
    exec(sql) {
      // No-op for CREATE TABLE since we use in-memory maps
      return this;
    },
    
    // Pragma (no-op)
    pragma(setting) {
      return this;
    },
    
    // Close (no-op)
    close() {
      saveToFile();
    }
  };
}

let dbInstance = null;

/**
 * Get database instance
 */
export function getDatabase() {
  if (!dbInstance) {
    dbInstance = initDatabase();
  }
  return dbInstance;
}

/**
 * Close database connection
 */
export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
