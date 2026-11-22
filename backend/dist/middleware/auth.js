"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireRole = requireRole;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const database_1 = require("../db/database");
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const payload = jsonwebtoken_1.default.verify(token, config_1.config.jwtSecret);
        // Check if user is still active in database
        const user = database_1.db.prepare(`
      SELECT id, full_name, email, role, account_status
      FROM users
      WHERE id = ?
    `).get(payload.userId);
        if (!user) {
            res.status(401).json({ error: 'User account not found.' });
            return;
        }
        if (user.account_status === 'suspended') {
            res.status(403).json({ error: 'This account has been suspended by administration due to fraud or security review.' });
            return;
        }
        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            fullName: user.full_name,
        };
        req.token = token;
        next();
    }
    catch (err) {
        res.status(401).json({ error: 'Invalid or expired session token.' });
    }
}
function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({
                error: `Access forbidden: Requires role [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`,
            });
            return;
        }
        next();
    };
}
