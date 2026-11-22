import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { AssistantWidget } from './components/AssistantWidget';
import { MarketplacePage } from './pages/MarketplacePage';
import { BuyerDashboard } from './pages/BuyerDashboard';
import { SellerDashboard } from './pages/SellerDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { UserSession } from './types';
import { apiRequest } from './services/api';
import { Bell, X, ShieldCheck } from 'lucide-react';

const DEMO_USERS = {
  buyer: {
    email: 'buyer@trustpass.com',
    password: 'Password@123',
    role: 'buyer' as const,
    fullName: 'Aarav Sharma (Buyer)',
    id: 'user-buyer-1',
  },
  seller: {
    email: 'seller@trustpass.com',
    password: 'Password@123',
    role: 'seller' as const,
    fullName: 'Vikram Reddy (Seller)',
    id: 'user-seller-1',
  },
  admin: {
    email: 'admin@trustpass.com',
    password: 'Password@123',
    role: 'admin' as const,
    fullName: 'Platform Administrator',
    id: 'user-admin-1',
  },
};

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'marketplace' | 'buyer' | 'seller' | 'admin'>('marketplace');
  const [selectedCity, setSelectedCity] = useState<string>('Medchal, Hyderabad');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [session, setSession] = useState<UserSession>({
    user: DEMO_USERS.buyer,
    token: '',
  });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false);

  // Authenticate demo user to get fresh token
  const authenticateDemoUser = async (role: 'buyer' | 'seller' | 'admin') => {
    try {
      const demo = DEMO_USERS[role];
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: { identifier: demo.email, password: demo.password },
      });

      setSession({
        user: res.user,
        token: res.token,
      });

      // Fetch notifications
      const notifRes = await apiRequest('/notifications', { token: res.token }).catch(() => ({ notifications: [] }));
      setNotifications(notifRes.notifications || []);
    } catch (err) {
      console.error('Demo auth failed', err);
    }
  };

  useEffect(() => {
    authenticateDemoUser('buyer');
  }, []);

  const handleSwitchRole = (role: 'buyer' | 'seller' | 'admin') => {
    authenticateDemoUser(role);
    if (role === 'buyer') setCurrentTab('buyer');
    else if (role === 'seller') setCurrentTab('seller');
    else if (role === 'admin') setCurrentTab('admin');
  };

  const unreadCount = notifications.filter((n) => !n.read_status).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-['Inter',sans-serif]">
      {/* Navigation Bar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        session={session}
        onSwitchRole={handleSwitchRole}
        notificationsCount={unreadCount}
        onOpenNotifications={() => setShowNotificationsDrawer(true)}
        selectedCity={selectedCity}
        setSelectedCity={setSelectedCity}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {currentTab === 'marketplace' && (
          <MarketplacePage 
            session={session} 
            onNavigateToBuyer={() => setCurrentTab('buyer')} 
            selectedCity={selectedCity}
            searchQuery={searchQuery}
          />
        )}
        {currentTab === 'buyer' && <BuyerDashboard session={session} />}
        {currentTab === 'seller' && <SellerDashboard session={session} />}
        {currentTab === 'admin' && <AdminDashboard session={session} />}
      </main>

      {/* Floating AI Support Assistant */}
      <AssistantWidget />

      {/* Notifications Drawer */}
      {showNotificationsDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm h-full shadow-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center space-x-2">
                  <Bell className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Transactional Notifications</h3>
                </div>
                <button
                  onClick={() => setShowNotificationsDrawer(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-4 space-y-3 overflow-y-auto max-h-[calc(100vh-140px)]">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">No notifications yet.</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3 rounded-xl border text-xs leading-relaxed space-y-1 ${
                        n.read_status ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-emerald-50/70 border-emerald-200 text-slate-900'
                      }`}
                    >
                      <span className="font-bold text-[10px] uppercase tracking-wider block text-emerald-800">
                        {n.notification_type}
                      </span>
                      <p>{n.message}</p>
                      <span className="text-[10px] text-slate-400 block pt-0.5">{n.created_at}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={() => {
                apiRequest('/notifications/mark-all-read', { method: 'POST', token: session.token });
                setNotifications((prev) => prev.map((item) => ({ ...item, read_status: 1 })));
              }}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
            >
              Mark all as read
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 py-8 px-4 text-center text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-white">TrustPass Platform Architecture</span>
          </div>
          <p>© 2026 TrustPass. Academic Reference Implementation. Not affiliated with BookMyShow.</p>
          <div className="flex space-x-4">
            <a href="#rules" onClick={(e) => { e.preventDefault(); alert('80% Fair Resale Cap Rule strictly enforced.'); }} className="hover:text-white transition">Fair Pricing Policy</a>
            <a href="#security" onClick={(e) => { e.preventDefault(); alert('HMAC fingerprinting prevents duplicate listings.'); }} className="hover:text-white transition">Security Standard</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
