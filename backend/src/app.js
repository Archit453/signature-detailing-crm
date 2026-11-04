import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './routes/index.js';
import { config } from './config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security and middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allows flexible assets and inline widgets in local dev
}));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// Legal and Compliance Pages (Meta App Review Requirements)
const publicDir = path.resolve(__dirname, '../../frontend/public');
const distDir = path.resolve(__dirname, '../../frontend/dist');

const sendLegalFile = (fileName, res) => {
  const distFile = path.join(distDir, fileName);
  const publicFile = path.join(publicDir, fileName);
  res.sendFile(distFile, (err) => {
    if (err) res.sendFile(publicFile, (err2) => {
      if (err2) res.status(404).send('Document not found');
    });
  });
};

app.get(['/privacy', '/api/privacy'], (req, res) => sendLegalFile('privacy.html', res));
app.get(['/terms', '/api/terms'], (req, res) => sendLegalFile('terms.html', res));
app.get(['/data-deletion', '/api/data-deletion'], (req, res) => sendLegalFile('data-deletion.html', res));

// API Routes
app.use('/api', apiRouter);

// Serve Frontend static build in standalone live server mode
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDistPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Signature Detailing CRM API</title></head>
          <body style="font-family: sans-serif; background: #090A0F; color: #fff; padding: 40px; text-align: center;">
            <h1 style="color: #F59E0B;">Signature Detailing CRM Backend</h1>
            <p>API is active. Health: <a href="/api/health" style="color: #60A5FA;">/api/health</a></p>
            <p style="color: #9CA3AF;">Frontend build will serve here when built via <code>npm run build</code>.</p>
          </body>
        </html>
      `);
    }
  });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  console.error(`[Error ${statusCode}] ${req.method} ${req.url} —`, err.message);

  res.status(statusCode).json({
    success: false,
    message,
    errors: err.errors || [],
    stack: config.nodeEnv === 'development' ? err.stack : undefined,
  });
});

export default app;

