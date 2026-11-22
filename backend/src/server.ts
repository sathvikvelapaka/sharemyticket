import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import client from 'prom-client';
import { config } from './config';
import { initDatabase, db } from './db/database';
import { startExpirationScheduler } from './services/expirationWorker';
import { authRouter } from './modules/auth/authRoutes';
import { userRouter } from './modules/users/userRoutes';
import { listingRouter } from './modules/listings/listingRoutes';
import { requirementRouter } from './modules/requirements/requirementRoutes';
import { requestRouter } from './modules/requests/requestRoutes';
import { paymentRouter } from './modules/payments/paymentRoutes';
import { transferRouter } from './modules/transfers/transferRoutes';
import { disputeRouter } from './modules/disputes/disputeRoutes';
import { ratingRouter } from './modules/ratings/ratingRoutes';
import { assistantRouter } from './modules/assistant/assistantRoutes';
import { adminRouter } from './modules/admin/adminRoutes';
import { notificationRouter } from './modules/notifications/notificationRoutes';

export const app = express();

// Initialize database schema and seed data
initDatabase();

// Start background reservation & listing expiration worker
startExpirationScheduler();

// Prometheus Metrics Setup
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

const httpRequestsTotal = new client.Counter({
  name: 'trustpass_http_requests_total',
  help: 'Total number of HTTP requests processed by TrustPass',
  labelNames: ['method', 'route', 'status'],
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Metrics tracing middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  res.on('finish', () => {
    const route = req.route ? req.route.path : req.path;
    httpRequestsTotal.inc({ method: req.method, route, status: res.statusCode.toString() });
  });
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    platform: 'TrustPass Secure Resale System',
    timestamp: new Date().toISOString(),
    database: 'connected',
  });
});

// Prometheus metrics endpoint
app.get('/metrics', async (req: Request, res: Response) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// Venues helper route for frontend dropdowns
app.get('/api/v1/venues', (req: Request, res: Response) => {
  const venues = db.prepare('SELECT * FROM venues ORDER BY city, venue_name').all();
  res.json({ venues });
});

// Mount modular API routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/listings', listingRouter);
app.use('/api/v1/requirements', requirementRouter);
app.use('/api/v1', requestRouter);
app.use('/api/v1/payments', paymentRouter);
app.use('/api/v1', paymentRouter);
app.use('/api/v1/transfers', transferRouter);
app.use('/api/v1/disputes', disputeRouter);
app.use('/api/v1/ratings', ratingRouter);
app.use('/api/v1/assistant', assistantRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/notifications', notificationRouter);

// Centralized Error Handling Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
  });
});

// Only listen if not imported by test runner
if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`TrustPass Backend running securely on http://localhost:${config.port}`);
  });
}
