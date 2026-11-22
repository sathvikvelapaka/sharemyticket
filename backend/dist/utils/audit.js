"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAuditEvent = logAuditEvent;
const database_1 = require("../db/database");
const uuid_1 = require("uuid");
function logAuditEvent(entry) {
    try {
        const stmt = database_1.db.prepare(`
      INSERT INTO audit_logs (id, actor_id, action, resource_type, resource_id, correlation_id, outcome, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
        stmt.run((0, uuid_1.v4)(), entry.actorId, entry.action, entry.resourceType, entry.resourceId, entry.correlationId || null, entry.outcome, entry.details ? JSON.stringify(entry.details) : null);
    }
    catch (err) {
        console.error('Failed to write audit log:', err);
    }
}
