import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, Users, Scale, FileText, BarChart3, AlertTriangle, 
  CheckCircle2, Ban, RefreshCw, ArrowUpRight 
} from 'lucide-react';
import { UserSession, FraudAlert, Dispute, AuditLog } from '../types';
import { apiRequest } from '../services/api';

interface AdminDashboardProps {
  session: UserSession;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ session }) => {
  const [activeTab, setActiveTab] = useState<'fraud' | 'disputes' | 'users' | 'audit' | 'analytics'>('fraud');
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [alertsRes, disputesRes, usersRes, logsRes, analyticsRes] = await Promise.all([
        apiRequest('/admin/fraud-alerts', { token: session.token }),
        apiRequest('/admin/disputes', { token: session.token }),
        apiRequest('/admin/users', { token: session.token }),
        apiRequest('/admin/audit-logs', { token: session.token }),
        apiRequest('/assistant/demand-analytics'),
      ]);

      setFraudAlerts(alertsRes.alerts || []);
      setDisputes(disputesRes.disputes || []);
      setUsers(usersRes.users || []);
      setAuditLogs(logsRes.logs || []);
      setAnalytics(analyticsRes);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [session.token]);

  const handleSuspendUser = async (userId: string) => {
    try {
      await apiRequest(`/admin/users/${userId}/suspend`, {
        method: 'POST',
        token: session.token,
        body: { reason: 'Suspended by admin following fraud risk investigation' },
      });
      setActionMessage({ type: 'success', text: 'User suspended and all active sessions revoked.' });
      fetchAdminData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleActivateUser = async (userId: string) => {
    try {
      await apiRequest(`/admin/users/${userId}/activate`, {
        method: 'POST',
        token: session.token,
      });
      setActionMessage({ type: 'success', text: 'User account restored to active status.' });
      fetchAdminData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleResolveDispute = async (disputeId: string, decision: 'resolved_refund' | 'resolved_seller_paid') => {
    try {
      await apiRequest(`/admin/disputes/${disputeId}`, {
        method: 'PATCH',
        token: session.token,
        body: { decision, adminNotes: `Admin reviewed transaction logs and approved ${decision}.` },
      });
      setActionMessage({ type: 'success', text: `Dispute resolved as ${decision}.` });
      fetchAdminData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
            Platform Administrator Control
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1">TrustPass Security & Governance Console</h1>
          <p className="text-sm text-slate-500">Monitor automated AI fraud scores, resolve disputes, oversee audit logs and regulate resale policies.</p>
        </div>

        <button
          onClick={fetchAdminData}
          className="flex items-center space-x-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50 shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Feeds</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 text-sm font-semibold overflow-x-auto whitespace-nowrap">
        <button
          onClick={() => setActiveTab('fraud')}
          className={`pb-3 px-3 transition border-b-2 flex items-center space-x-1.5 ${
            activeTab === 'fraud'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          <span>Fraud Risk Alerts ({fraudAlerts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('disputes')}
          className={`pb-3 px-3 transition border-b-2 flex items-center space-x-1.5 ${
            activeTab === 'disputes'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>Disputes & Refunds ({disputes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 px-3 transition border-b-2 flex items-center space-x-1.5 ${
            activeTab === 'users'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Platform Accounts ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-3 transition border-b-2 flex items-center space-x-1.5 ${
            activeTab === 'audit'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Audit Trail ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 px-3 transition border-b-2 flex items-center space-x-1.5 ${
            activeTab === 'analytics'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Demand Analytics</span>
        </button>
      </div>

      {/* Alert Banner */}
      {actionMessage && (
        <div
          className={`px-4 py-3 rounded-xl flex items-center space-x-2 text-sm font-medium ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {actionMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* TAB 1: Fraud Risk Alerts */}
      {activeTab === 'fraud' && (
        <div className="space-y-4">
          {fraudAlerts.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="font-bold text-slate-800">Zero active fraud alerts</h3>
              <p className="text-xs text-slate-500">All user accounts and listing fingerprints comply with security rules.</p>
            </div>
          ) : (
            fraudAlerts.map((alert) => (
              <div key={alert.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        alert.risk_level === 'high' ? 'bg-rose-100 text-rose-800' :
                        alert.risk_level === 'medium' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        Risk: {alert.risk_level} (Score: {alert.risk_score}/100)
                      </span>
                      <h3 className="font-bold text-sm text-slate-900">{alert.user_name} ({alert.user_email})</h3>
                    </div>
                    <p className="text-xs text-rose-700 font-medium mt-1">{alert.reason}</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleSuspendUser(alert.user_id)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1 shadow-sm transition"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Suspend Account</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: Disputes */}
      {activeTab === 'disputes' && (
        <div className="space-y-4">
          {disputes.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="font-bold text-slate-800">No unresolved disputes</h3>
              <p className="text-xs text-slate-500">Every ticket transfer is operating cleanly.</p>
            </div>
          ) : (
            disputes.map((d) => (
              <div key={d.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                <div className="flex justify-between items-start border-b pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                        {d.dispute_category}
                      </span>
                      <span className="text-xs text-slate-500">Raised by: {d.raised_by_name}</span>
                    </div>
                    <p className="text-xs text-slate-700 mt-2">{d.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-900">₹{d.total_amount / 100}</span>
                    <span className="text-[10px] block text-slate-400">{d.dispute_status}</span>
                  </div>
                </div>

                {d.dispute_status === 'opened' && (
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleResolveDispute(d.id, 'resolved_refund')}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                    >
                      Approve Full Gateway Refund to Buyer
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResolveDispute(d.id, 'resolved_seller_paid')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                    >
                      Release Settlement to Seller
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: Accounts */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-900">{u.full_name}</div>
                    <div className="text-slate-400 text-[11px]">{u.email} • {u.phone}</div>
                  </td>
                  <td className="px-4 py-3 font-semibold uppercase text-slate-700">{u.role}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                      u.account_status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {u.account_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.account_status === 'active' ? (
                      <button
                        type="button"
                        onClick={() => handleSuspendUser(u.id)}
                        className="text-rose-600 hover:underline font-semibold"
                      >
                        Suspend
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleActivateUser(u.id)}
                        className="text-emerald-600 hover:underline font-semibold"
                      >
                        Activate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Actor</th>
                <th className="px-4 py-3 text-left">Resource</th>
                <th className="px-4 py-3 text-left">Outcome</th>
                <th className="px-4 py-3 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-bold text-slate-900">{log.action}</td>
                  <td className="px-4 py-2 text-slate-600">{log.actor_id}</td>
                  <td className="px-4 py-2 text-slate-500">{log.resource_type}: {log.resource_id}</td>
                  <td className="px-4 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      log.outcome === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' :
                      log.outcome === 'BLOCKED' ? 'bg-rose-100 text-rose-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {log.outcome}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-slate-400">{log.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 5: Analytics */}
      {activeTab === 'analytics' && analytics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <span className="text-xs text-slate-500 uppercase font-bold">Active Resale Listings</span>
            <div className="text-3xl font-extrabold text-slate-900">{analytics.summary.activeListings}</div>
            <p className="text-xs text-emerald-600 font-medium">All capped at ≤80% face value</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <span className="text-xs text-slate-500 uppercase font-bold">Average Buyer Savings</span>
            <div className="text-3xl font-extrabold text-emerald-600">₹{analytics.summary.avgSavingsRupees}</div>
            <p className="text-xs text-slate-500">Average discount: {analytics.summary.avgDiscountPercent}%</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <span className="text-xs text-slate-500 uppercase font-bold">Top City Listings</span>
            <div className="space-y-1 pt-1 text-xs">
              {(analytics.listingsByCity || []).map((c: any, idx: number) => (
                <div key={idx} className="flex justify-between text-slate-700">
                  <span>{c.city}</span>
                  <span className="font-bold">{c.active_listings} listings</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
