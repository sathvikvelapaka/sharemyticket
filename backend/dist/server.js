"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const prom_client_1 = __importDefault(require("prom-client"));
const config_1 = require("./config");
const database_1 = require("./db/database");
const expirationWorker_1 = require("./services/expirationWorker");
const authRoutes_1 = require("./modules/auth/authRoutes");
const userRoutes_1 = require("./modules/users/userRoutes");
const listingRoutes_1 = require("./modules/listings/listingRoutes");
const requirementRoutes_1 = require("./modules/requirements/requirementRoutes");
const requestRoutes_1 = require("./modules/requests/requestRoutes");
const paymentRoutes_1 = require("./modules/payments/paymentRoutes");
const transferRoutes_1 = require("./modules/transfers/transferRoutes");
const disputeRoutes_1 = require("./modules/disputes/disputeRoutes");
const ratingRoutes_1 = require("./modules/ratings/ratingRoutes");
const assistantRoutes_1 = require("./modules/assistant/assistantRoutes");
const adminRoutes_1 = require("./modules/admin/adminRoutes");
const notificationRoutes_1 = require("./modules/notifications/notificationRoutes");
exports.app = (0, express_1.default)();
// Initialize database schema and seed data
(0, database_1.initDatabase)();
// Start background reservation & listing expiration worker
(0, expirationWorker_1.startExpirationScheduler)();
// Prometheus Metrics Setup
const collectDefaultMetrics = prom_client_1.default.collectDefaultMetrics;
collectDefaultMetrics({ register: prom_client_1.default.register });
const httpRequestsTotal = new prom_client_1.default.Counter({
    name: 'trustpass_http_requests_total',
    help: 'Total number of HTTP requests processed by TrustPass',
    labelNames: ['method', 'route', 'status'],
});
// Middleware
exports.app.use((0, cors_1.default)());
exports.app.use(express_1.default.json());
exports.app.use(express_1.default.urlencoded({ extended: true }));
// Metrics tracing middleware
exports.app.use((req, res, next) => {
    res.on('finish', () => {
        const route = req.route ? req.route.path : req.path;
        httpRequestsTotal.inc({ method: req.method, route, status: res.statusCode.toString() });
    });
    next();
});
// Health check endpoint
exports.app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        platform: 'TrustPass Secure Resale System',
        timestamp: new Date().toISOString(),
        database: 'connected',
    });
});
// Prometheus metrics endpoint
exports.app.get('/metrics', async (req, res) => {
    res.set('Content-Type', prom_client_1.default.register.contentType);
    res.end(await prom_client_1.default.register.metrics());
});
// Venues helper route for frontend dropdowns
exports.app.get('/api/v1/venues', (req, res) => {
    const venues = database_1.db.prepare('SELECT * FROM venues ORDER BY city, venue_name').all();
    res.json({ venues });
});
// Mount modular API routes
exports.app.use('/api/v1/auth', authRoutes_1.authRouter);
exports.app.use('/api/v1/users', userRoutes_1.userRouter);
exports.app.use('/api/v1/listings', listingRoutes_1.listingRouter);
exports.app.use('/api/v1/requirements', requirementRoutes_1.requirementRouter);
exports.app.use('/api/v1', requestRoutes_1.requestRouter);
exports.app.use('/api/v1/payments', paymentRoutes_1.paymentRouter);
exports.app.use('/api/v1', paymentRoutes_1.paymentRouter);
exports.app.use('/api/v1/transfers', transferRoutes_1.transferRouter);
exports.app.use('/api/v1/disputes', disputeRoutes_1.disputeRouter);
exports.app.use('/api/v1/ratings', ratingRoutes_1.ratingRouter);
exports.app.use('/api/v1/assistant', assistantRoutes_1.assistantRouter);
exports.app.use('/api/v1/admin', adminRoutes_1.adminRouter);
exports.app.use('/api/v1/notifications', notificationRoutes_1.notificationRouter);
// Centralized Error Handling Middleware
exports.app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    res.status(err.status || 500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
    });
});
// Only listen if not imported by test runner
if (process.env.NODE_ENV !== 'test') {
    exports.app.listen(config_1.config.port, () => {
        console.log(`TrustPass Backend running securely on http://localhost:${config_1.config.port}`);
    });
}
