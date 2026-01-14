import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http2 from 'http2';
import http from 'http';

import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import clientsRoutes from './routes/clients.js';
import projectsRoutes from './routes/projects.js';
import tasksRoutes from './routes/tasks.js';
import entriesRoutes from './routes/entries.js';
import settingsRoutes from './routes/settings.js';
import ldapRoutes from './routes/ldap.js';
import generalSettingsRoutes from './routes/general-settings.js';
import productsRoutes from './routes/products.js';
import quotesRoutes from './routes/quotes.js';
import workUnitsRoutes from './routes/work-units.js';
import salesRoutes from './routes/sales.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/entries', entriesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/ldap', ldapRoutes);
app.use('/api/general-settings', generalSettingsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/work-units', workUnitsRoutes);
app.use('/api/sales', salesRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Helper function to convert HTTP/2 request to Express-compatible format
function convertH2Request(h2Req, h2Res) {
  // Create a new object that mimics http.IncomingMessage
  // HTTP/2 request objects have read-only properties, so we create a wrapper
  const req = {};
  
  // Map HTTP/2 headers to HTTP/1.1 format (lowercase keys)
  // HTTP/2 headers are already lowercase, but ensure compatibility
  const normalizedHeaders = {};
  for (const [key, value] of Object.entries(h2Req.headers)) {
    normalizedHeaders[key.toLowerCase()] = value;
  }
  
  // Define properties using getters/setters to access HTTP/2 request
  Object.defineProperty(req, 'headers', {
    get: () => normalizedHeaders,
    enumerable: true,
    configurable: true
  });
  
  Object.defineProperty(req, 'method', {
    get: () => h2Req.method || 'GET',
    set: (val) => { /* Express may try to set this, ignore */ },
    enumerable: true,
    configurable: true
  });
  
  Object.defineProperty(req, 'httpVersion', {
    get: () => '2.0',
    enumerable: true,
    configurable: true
  });
  
  Object.defineProperty(req, 'httpVersionMajor', {
    get: () => 2,
    enumerable: true,
    configurable: true
  });
  
  Object.defineProperty(req, 'httpVersionMinor', {
    get: () => 0,
    enumerable: true,
    configurable: true
  });
  
  Object.defineProperty(req, 'socket', {
    get: () => h2Req.socket || { encrypted: false },
    enumerable: true,
    configurable: true
  });
  
  Object.defineProperty(req, 'connection', {
    get: () => req.socket,
    enumerable: true,
    configurable: true
  });
  
  // Proxy stream methods from HTTP/2 request
  req.read = h2Req.read.bind(h2Req);
  req.on = h2Req.on.bind(h2Req);
  req.once = h2Req.once.bind(h2Req);
  req.pipe = h2Req.pipe.bind(h2Req);
  req.pause = h2Req.pause.bind(h2Req);
  req.resume = h2Req.resume.bind(h2Req);
  req.setEncoding = h2Req.setEncoding?.bind(h2Req) || (() => {});
  
  // Store writable url for Express middleware that modifies it
  let writableUrl = h2Req.path || h2Req.url || '/';
  Object.defineProperty(req, 'url', {
    get: () => writableUrl,
    set: (val) => { writableUrl = val; },
    enumerable: true,
    configurable: true
  });
  
  // Create a response object that mimics http.ServerResponse
  const res = Object.create(http.ServerResponse.prototype);
  res.statusCode = 200;
  res.statusMessage = 'OK';
  res.headersSent = false;
  res.finished = false;
  
  // Implement Express response methods
  res.status = function(code) {
    this.statusCode = code;
    return this;
  };
  
  res.setHeader = function(name, value) {
    if (Array.isArray(value)) {
      h2Res.setHeader(name, value);
    } else {
      h2Res.setHeader(name, value);
    }
  };
  
  res.getHeader = function(name) {
    return h2Res.getHeader(name);
  };
  
  res.removeHeader = function(name) {
    h2Res.removeHeader(name);
  };
  
  res.getHeaders = function() {
    return h2Res.getHeaders();
  };
  
  res.writeHead = function(statusCode, statusMessage, headers) {
    if (!this.headersSent) {
      this.statusCode = statusCode;
      if (typeof statusMessage === 'string') {
        this.statusMessage = statusMessage;
      } else if (statusMessage) {
        headers = statusMessage;
      }
      if (headers) {
        Object.entries(headers).forEach(([key, value]) => {
          h2Res.setHeader(key, value);
        });
      }
      h2Res.writeHead(statusCode, headers);
      this.headersSent = true;
    }
  };
  
  res.write = function(chunk, encoding, callback) {
    if (!this.headersSent) {
      this.writeHead(this.statusCode);
    }
    return h2Res.write(chunk, encoding, callback);
  };
  
  res.end = function(chunk, encoding, callback) {
    if (!this.headersSent) {
      this.writeHead(this.statusCode);
    }
    this.finished = true;
    if (chunk) {
      h2Res.end(chunk, encoding, callback);
    } else {
      h2Res.end(encoding, callback);
    }
  };
  
  res.json = function(obj) {
    if (!this.getHeader('Content-Type')) {
      this.setHeader('Content-Type', 'application/json');
    }
    this.end(JSON.stringify(obj));
  };
  
  res.send = function(data) {
    if (typeof data === 'object' && !Buffer.isBuffer(data) && data !== null) {
      if (!this.getHeader('Content-Type')) {
        this.setHeader('Content-Type', 'application/json');
      }
      this.end(JSON.stringify(data));
    } else {
      this.end(data);
    }
  };
  
  return { req, res };
}

// Create HTTP/2 server with HTTP/1.1 fallback support
const server = http2.createServer({
  allowHTTP1: true
}, (req, res) => {
  // Check if this is an HTTP/2 request
  if (req instanceof http2.Http2ServerRequest) {
    const { req: expressReq, res: expressRes } = convertH2Request(req, res);
    app(expressReq, expressRes);
  } else {
    // HTTP/1.1 request - use Express directly
    app(req, res);
  }
});

// Startup function
async function startServer() {
  try {
    // Run automatic migration on startup
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');

    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      // Import query from db module dynamically to ensure it's loaded
      const { query } = await import('./db/index.js');
      // Split by semicolon and run each to be safer and see progress, 
      // but simple query(schemaSql) also works for multiple statements in pg.
      await query(schemaSql);

      // Explicitly verify that the new tables exist
      const tableCheck = await query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name IN ('user_clients', 'user_projects', 'user_tasks')
      `);

      const foundTables = tableCheck.rows.map(r => r.table_name);
      console.log(`Database schema verified. Found tables: ${foundTables.join(', ')}`);

      if (!foundTables.includes('user_clients')) {
        console.error('CRITICAL: user_clients table was not created!');
      }
    } else {
      console.warn('Schema file not found at:', schemaPath);
    }
  } catch (err) {
    console.error('Failed to run auto-migration:', err);
  }

  // Start the HTTP/2 server
  server.listen(PORT, () => {
    console.log(`Praetor API server running on port ${PORT} (HTTP/2 cleartext enabled)`);
  });

  // Periodic LDAP Sync Task (every hour)
  try {
    const ldapService = (await import('./services/ldap.js')).default;

    // Run once on startup if enabled (wait a bit for DB to settle if needed, but here is fine after migration)
    // Actually, let's just schedule it.

    const SYNC_INTERVAL = 60 * 60 * 1000; // 1 hour
    setInterval(async () => {
      try {
        // Reload config to check if enabled
        await ldapService.loadConfig();
        if (ldapService.config && ldapService.config.enabled) {
          console.log('Running periodic LDAP sync...');
          await ldapService.syncUsers();
        }
      } catch (err) {
        console.error('Periodic LDAP Sync Error:', err.message);
      }
    }, SYNC_INTERVAL);
  } catch (err) {
    console.error('Failed to initialize LDAP sync task:', err);
  }
}

startServer();

export default app;
