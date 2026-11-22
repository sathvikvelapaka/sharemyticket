import { db } from '../db/database';
import { v4 as uuidv4 } from 'uuid';

export interface AuditLogEntry {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  correlationId?: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'BLOCKED' | 'FLAGGED';
  details?: Record<string, any>;
}

export function logAuditEvent(entry: AuditLogEntry): void {
  try {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, actor_id, action, resource_type, resource_id, correlation_id, outcome, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.run(
      uuidv4(),
      entry.actorId,
      entry.action,
      entry.resourceType,
      entry.resourceId,
      entry.correlationId || null,
      entry.outcome,
      entry.details ? JSON.stringify(entry.details) : null
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
