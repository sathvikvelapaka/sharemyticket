import React, { useState, useEffect } from 'react';
import { 
  Ticket, Clock, CreditCard, Send, ShieldCheck, AlertCircle, CheckCircle2, 
  MapPin, Star, PlusCircle, Sparkles, AlertTriangle, ArrowRight, QrCode 
} from 'lucide-react';
import { UserSession, BuyerRequirement, PurchaseRequest } from '../types';
import { apiRequest } from '../services/api';
import { TicketPassModal } from '../components/TicketPassModal';

interface BuyerDashboardProps {
  session: UserSession;
}

export const BuyerDashboard: React.FC<BuyerDashboardProps> = ({ session }) => {
  const [activeTab, setActiveTab] = useState<'requests' | 'requirements' | 'disputes'>('requests');
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [requirements, setRequirements] = useState<BuyerRequirement[]>([]);
  const [smartMatches, setSmartMatches] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  // Forms & Modals state
  const [showReqModal, setShowReqModal] = useState(false);
  const [newReq, setNewReq] = useState({
    movieTitle: '',
    preferredCity: 'Hyderabad',
    preferredDate: new Date().toISOString().split('T')[0],
    maximumBudget: 400, // in rupees
    quantity: 1,
  });

  const [recipientForm, setRecipientForm] = useState<{ transactionId: string; name: string; email: string; phone: string } | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ transactionId: string; amountPaise: number } | null>(null);
  const [ratingModal, setRatingModal] = useState<{ transactionId: string; rating: number; comment: string } | null>(null);
  const [disputeModal, setDisputeModal] = useState<{ transactionId: string; category: string; description: string } | null>(null);
  const [selectedTicketForPass, setSelectedTicketForPass] = useState<any | null>(null);

  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchBuyerData = async () => {
    setLoading(true);
    try {
      const [reqData, requirementsData] = await Promise.all([
        apiRequest('/buyer/requests', { token: session.token }),
        apiRequest('/requirements', { token: session.token }),
      ]);

      setRequests(reqData.requests || []);
      setRequirements(requirementsData.requirements || []);

      // Fetch smart matches for each requirement
      const matchesMap: Record<string, any[]> = {};
      for (const reqItem of requirementsData.requirements || []) {
        try {
          const matchRes = await apiRequest(`/requirements/${reqItem.id}/matches`, { token: session.token });
          matchesMap[reqItem.id] = matchRes.matches || [];
        } catch (e) {
          // ignore
        }
      }
      setSmartMatches(matchesMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuyerData();
  }, [session.token]);

  const handleCreateRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/requirements', {
        method: 'POST',
        token: session.token,
        body: {
          ...newReq,
          maximumBudget: newReq.maximumBudget * 100, // convert rupees to paise
        },
      });

      setShowReqModal(false);
      setActionMessage({ type: 'success', text: 'Requirement posted! Smart Matching Engine is actively scanning.' });
      fetchBuyerData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleSubmitRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientForm) return;

    try {
      await apiRequest(`/transactions/${recipientForm.transactionId}/recipient`, {
        method: 'POST',
        token: session.token,
        body: {
          fullName: recipientForm.name,
          email: recipientForm.email,
          phone: recipientForm.phone,
        },
      });

      setActionMessage({ type: 'success', text: 'Recipient details encrypted with AES-256-GCM. Ready for payment!' });
      setRecipientForm(null);
      fetchBuyerData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleExecutePayment = async () => {
    if (!paymentModal) return;

    try {
      // 1. Create order
      const order = await apiRequest('/payments/create-order', {
        method: 'POST',
        token: session.token,
        body: { transactionId: paymentModal.transactionId },
      });

      // 2. Checkout sandbox
      await apiRequest('/payments/checkout-sandbox', {
        method: 'POST',
        token: session.token,
        body: { paymentId: order.paymentId, paymentMethod: 'UPI' },
      });

      setActionMessage({
        type: 'success',
        text: 'Payment of ₹' + (paymentModal.amountPaise / 100) + ' captured securely on sandbox. Seller has been notified to start official BookMyShow transfer!',
      });
      setPaymentModal(null);
      fetchBuyerData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleAcceptTransfer = async (transactionId: string) => {
    try {
      await apiRequest(`/transfers/${transactionId}/accept`, {
        method: 'POST',
        token: session.token,
      });

      const matchedReq = requests.find((r) => r.transaction_id === transactionId);
      setSelectedTicketForPass({
        eventName: matchedReq?.event_name || 'Dune: Part Two (IMAX 4K)',
        venueName: matchedReq?.venue_name || 'PVR Forum Sujana Mall',
        venueCity: 'Hyderabad',
        eventDate: matchedReq?.event_date || '2026-12-01',
        showTime: '07:30 PM',
        seatCategory: 'Prime Recliner',
        seats: 'K12, K13',
        transferRef: `BMS-XFER-${transactionId.substring(0, 8).toUpperCase()}`,
        recipientName: session.user.fullName || 'Verified Buyer',
        totalAmountRupees: matchedReq ? matchedReq.resale_price / 100 : 350,
      });

      setActionMessage({
        type: 'success',
        text: 'Ticket transfer officially confirmed by provider! Your verified QR Cinema Pass is displayed.',
      });
      fetchBuyerData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratingModal) return;

    try {
      await apiRequest('/ratings', {
        method: 'POST',
        token: session.token,
        body: {
          transactionId: ratingModal.transactionId,
          rating: ratingModal.rating,
          comment: ratingModal.comment,
        },
      });

      setActionMessage({ type: 'success', text: 'Thank you! Your verified transaction rating has been recorded.' });
      setRatingModal(null);
      fetchBuyerData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeModal) return;

    try {
      await apiRequest('/disputes', {
        method: 'POST',
        token: session.token,
        body: {
          transactionId: disputeModal.transactionId,
          disputeCategory: disputeModal.category,
          description: disputeModal.description,
        },
      });

      setActionMessage({ type: 'success', text: 'Dispute submitted. Platform administration will investigate and process refund.' });
      setDisputeModal(null);
      fetchBuyerData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Profile Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
            Authenticated as Buyer
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1">Buyer Operations Dashboard</h1>
          <p className="text-sm text-slate-500">Track purchase approvals, temporary reservations, secure payment and official provider transfers.</p>
        </div>

        <button
          onClick={() => setShowReqModal(true)}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs shadow-sm transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Post Ticket Requirement</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('requests')}
          className={`pb-3 px-3 transition border-b-2 ${
            activeTab === 'requests'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Active Requests & Transfers ({requests.length})
        </button>
        <button
          onClick={() => setActiveTab('requirements')}
          className={`pb-3 px-3 transition border-b-2 flex items-center space-x-1.5 ${
            activeTab === 'requirements'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4 text-emerald-500" />
          <span>My Requirements & Smart Matches ({requirements.length})</span>
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

      {/* TAB 1: Requests & Active Transfers */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {requests.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
              <Ticket className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">No active purchase requests yet</h3>
              <p className="text-xs text-slate-500">Go to "Browse Tickets" to find tickets and request them from sellers.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {requests.map((req) => (
                <div key={req.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-base font-bold text-slate-900">{req.event_name}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          req.request_status === 'accepted' ? 'bg-emerald-100 text-emerald-800' :
                          req.request_status === 'pending' ? 'bg-amber-100 text-amber-800' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          Request: {req.request_status}
                        </span>
                        {req.transaction_status && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-indigo-100 text-indigo-800">
                            Tx: {req.transaction_status}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{req.venue_name} • Show date: {req.event_date}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-lg font-extrabold text-slate-900">₹{req.resale_price / 100}</span>
                      <span className="text-[11px] text-slate-400 block">Seller: {req.seller_name}</span>
                    </div>
                  </div>

                  {/* Transaction Steps & Progression */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
                    {/* Step 1: Request Approved */}
                    <div className={`space-y-1 ${req.request_status === 'accepted' ? 'text-emerald-700' : 'text-slate-400'}`}>
                      <div className="font-bold flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>1. Seller Approval</span>
                      </div>
                      <p className="text-[11px] leading-snug">
                        {req.request_status === 'accepted' ? 'Seller approved! Ticket reserved for 10 min.' : 'Awaiting seller review.'}
                      </p>
                    </div>

                    {/* Step 2: Payment */}
                    <div className={`space-y-1 ${
                      req.transaction_status && req.transaction_status !== 'created' && req.transaction_status !== 'payment_pending'
                        ? 'text-emerald-700'
                        : 'text-slate-400'
                    }`}>
                      <div className="font-bold flex items-center space-x-1">
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>2. Gateway Payment</span>
                      </div>
                      <p className="text-[11px] leading-snug">
                        {req.transaction_status && req.transaction_status !== 'payment_pending'
                          ? 'Captured & held in conditional escrow.'
                          : 'Pending payment within reservation timer.'}
                      </p>
                    </div>

                    {/* Step 3: Provider Transfer */}
                    <div className={`space-y-1 ${
                      req.transaction_status === 'transfer_initiated' || req.transaction_status === 'completed'
                        ? 'text-emerald-700'
                        : 'text-slate-400'
                    }`}>
                      <div className="font-bold flex items-center space-x-1">
                        <Send className="w-3.5 h-3.5" />
                        <span>3. BookMyShow Transfer</span>
                      </div>
                      <p className="text-[11px] leading-snug">
                        {req.transaction_status === 'transfer_initiated'
                          ? 'Official transfer initiated! Please accept.'
                          : req.transaction_status === 'completed'
                          ? 'Transfer verified & accepted.'
                          : 'Awaiting seller transfer initiation.'}
                      </p>
                    </div>

                    {/* Step 4: Completion */}
                    <div className={`space-y-1 ${req.transaction_status === 'completed' ? 'text-emerald-700' : 'text-slate-400'}`}>
                      <div className="font-bold flex items-center space-x-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>4. Settlement & Rating</span>
                      </div>
                      <p className="text-[11px] leading-snug">
                        {req.transaction_status === 'completed' ? 'Settlement released to seller.' : 'Locked until transfer verified.'}
                      </p>
                    </div>
                  </div>

                  {/* Contextual Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* If accepted and payment pending: submit recipient details then pay */}
                      {req.request_status === 'accepted' && (!req.transaction_status || req.transaction_status === 'payment_pending') && (
                        <>
                          <button
                            onClick={() => setRecipientForm({ transactionId: req.transaction_id!, name: session.user.fullName, email: session.user.email, phone: '+919876543210' })}
                            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition"
                          >
                            Step 1: Recipient Transfer Info
                          </button>

                          <button
                            onClick={() => setPaymentModal({ transactionId: req.transaction_id!, amountPaise: req.resale_price })}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-md shadow-emerald-600/20"
                          >
                            <CreditCard className="w-4 h-4" />
                            <span>Step 2: Pay ₹{req.resale_price / 100} Securely</span>
                          </button>
                        </>
                      )}

                      {/* If transfer initiated: accept transfer */}
                      {(req.transaction_status === 'transfer_initiated' || req.transaction_status === 'paid_awaiting_transfer') && (
                        <button
                          onClick={() => handleAcceptTransfer(req.transaction_id!)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-md shadow-emerald-600/20"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>Accept Official Provider Transfer</span>
                        </button>
                      )}

                      {/* Rating button for completed transactions */}
                      {req.transaction_status === 'completed' && (
                        <>
                          <button
                            onClick={() => setSelectedTicketForPass({
                              eventName: req.event_name,
                              venueName: req.venue_name,
                              venueCity: 'Hyderabad',
                              eventDate: req.event_date,
                              showTime: '07:30 PM',
                              seatCategory: 'Prime Recliner',
                              seats: 'K12, K13',
                              transferRef: `BMS-XFER-${req.transaction_id ? req.transaction_id.substring(0, 8).toUpperCase() : 'AUTH'}`,
                              recipientName: session.user.fullName,
                              totalAmountRupees: req.resale_price / 100,
                            })}
                            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm"
                          >
                            <QrCode className="w-4 h-4 text-emerald-400" />
                            <span>View QR Cinema Pass</span>
                          </button>

                          <button
                            onClick={() => setRatingModal({ transactionId: req.transaction_id!, rating: 5, comment: '' })}
                            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold transition flex items-center space-x-1 shadow-sm"
                          >
                            <Star className="w-3.5 h-3.5" />
                            <span>Rate Seller</span>
                          </button>
                        </>
                      )}
                    </div>

                    {/* Small subtle dispute option */}
                    {req.transaction_status && req.transaction_status !== 'created' && req.transaction_status !== 'payment_pending' && req.transaction_status !== 'refunded' && (
                      <button
                        onClick={() => setDisputeModal({ transactionId: req.transaction_id!, category: 'SELLER_DID_NOT_TRANSFER', description: '' })}
                        className="text-slate-400 hover:text-rose-600 text-[11px] font-medium transition underline"
                      >
                        Need help? Report Issue
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Requirements & Smart Matches */}
      {activeTab === 'requirements' && (
        <div className="space-y-6">
          {requirements.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
              <Sparkles className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">No ticket requirements posted yet</h3>
              <p className="text-xs text-slate-500">Post what movie, cinema and budget you need. TrustPass matches suitable listings automatically!</p>
            </div>
          ) : (
            requirements.map((req) => (
              <div key={req.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{req.movie_title}</h3>
                    <p className="text-xs text-slate-500">Preferred City: {req.preferred_city} • Date: {req.preferred_date}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Max Budget: </span>
                    <span className="text-base font-bold text-emerald-600">₹{req.maximum_budget / 100}</span>
                  </div>
                </div>

                {/* Smart Matches List */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500 mr-1" />
                    Smart Matching Results ({(smartMatches[req.id] || []).length})
                  </h4>

                  {(smartMatches[req.id] || []).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Scanning marketplace for newly listed tickets matching this requirement...</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(smartMatches[req.id] || []).map((match, idx) => (
                        <div key={idx} className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl flex items-center justify-between">
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className="text-xs font-bold text-slate-900">{match.listing.event_name}</span>
                              <span className="text-[10px] font-extrabold bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded">
                                {match.matchScore}% Match
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 mt-0.5">{match.explanation}</p>
                            <span className="text-xs font-bold text-slate-900">₹{match.listing.resale_price / 100}</span>
                          </div>

                          <button
                            onClick={() => {
                              apiRequest(`/listings/${match.listing.id}/requests`, {
                                method: 'POST',
                                token: session.token,
                                body: { quantity: 1 },
                              }).then(() => {
                                setActionMessage({ type: 'success', text: 'Purchase request sent to seller from Smart Match!' });
                                fetchBuyerData();
                              });
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 shadow-sm"
                          >
                            <span>Request</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Post Requirement Modal */}
      {showReqModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Post What Ticket You Need</h3>
            <form onSubmit={handleCreateRequirement} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Movie / Event Name</label>
                <input
                  type="text"
                  required
                  value={newReq.movieTitle}
                  onChange={(e) => setNewReq({ ...newReq, movieTitle: e.target.value })}
                  placeholder="e.g. Dune: Part Two"
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">City</label>
                  <select
                    value={newReq.preferredCity}
                    onChange={(e) => setNewReq({ ...newReq, preferredCity: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  >
                    <option value="Hyderabad">Hyderabad</option>
                    <option value="Bangalore">Bangalore</option>
                    <option value="Mumbai">Mumbai</option>
                    <option value="Delhi">Delhi</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Show Date</label>
                  <input
                    type="date"
                    required
                    value={newReq.preferredDate}
                    onChange={(e) => setNewReq({ ...newReq, preferredDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Maximum Budget (₹)</label>
                <input
                  type="number"
                  required
                  value={newReq.maximumBudget}
                  onChange={(e) => setNewReq({ ...newReq, maximumBudget: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowReqModal(false)}
                  className="px-4 py-2 text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-xl"
                >
                  Post Requirement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recipient Details Modal */}
      {recipientForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Submit Private Recipient Details</h3>
            <p className="text-xs text-slate-500">
              The seller will use these details strictly inside the official BookMyShow application to transfer the ticket. Encrypted with AES-256-GCM.
            </p>
            <form onSubmit={handleSubmitRecipient} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={recipientForm.name}
                  onChange={(e) => setRecipientForm({ ...recipientForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Registered BookMyShow Email</label>
                <input
                  type="email"
                  required
                  value={recipientForm.email}
                  onChange={(e) => setRecipientForm({ ...recipientForm, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Mobile Number</label>
                <input
                  type="text"
                  required
                  value={recipientForm.phone}
                  onChange={(e) => setRecipientForm({ ...recipientForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setRecipientForm(null)}
                  className="px-4 py-2 text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-xl"
                >
                  Encrypt & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sandbox Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Sandbox Payment Checkout</h3>
            <p className="text-xs text-slate-500">
              Demonstrates conditional marketplace settlement. Funds are safely captured but <strong>withheld from the seller</strong> until you verify the authorized ticket transfer.
            </p>
            <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Resale Price</span>
                <span className="font-bold">₹{paymentModal.amountPaise / 100}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Platform Convenience Fee (5%)</span>
                <span className="font-bold">₹{(paymentModal.amountPaise * 0.05) / 100}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-extrabold text-sm text-slate-900">
                <span>Total Payable</span>
                <span>₹{(paymentModal.amountPaise * 1.05) / 100}</span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setPaymentModal(null)}
                className="px-4 py-2 text-slate-600 font-medium text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleExecutePayment}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow-md shadow-emerald-600/20"
              >
                Simulate UPI Payment Success
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {disputeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <h3 className="text-base font-bold text-rose-600">Open Transaction Dispute</h3>
            <form onSubmit={handleSubmitDispute} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Dispute Category</label>
                <select
                  value={disputeModal.category}
                  onChange={(e) => setDisputeModal({ ...disputeModal, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                >
                  <option value="SELLER_DID_NOT_TRANSFER">Seller did not initiate transfer</option>
                  <option value="TRANSFER_INVITATION_NOT_RECEIVED">Transfer invitation not received</option>
                  <option value="TICKET_DETAILS_MISMATCH">Ticket details mismatched listing</option>
                  <option value="INVALID_TICKET_CLAIM">Provider reported ticket invalid</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Description of Issue</label>
                <textarea
                  required
                  rows={3}
                  value={disputeModal.description}
                  onChange={(e) => setDisputeModal({ ...disputeModal, description: e.target.value })}
                  placeholder="Provide evidence details..."
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDisputeModal(null)}
                  className="px-4 py-2 text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 text-white font-semibold rounded-xl"
                >
                  Submit Dispute
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {ratingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Rate Seller</h3>
            <form onSubmit={handleSubmitRating} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Rating (1 to 5 Stars)</label>
                <select
                  value={ratingModal.rating}
                  onChange={(e) => setRatingModal({ ...ratingModal, rating: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 border rounded-xl"
                >
                  <option value="5">★★★★★ 5 - Excellent Experience</option>
                  <option value="4">★★★★☆ 4 - Good & Timely</option>
                  <option value="3">★★★☆☆ 3 - Average</option>
                  <option value="2">★★☆☆☆ 2 - Poor</option>
                  <option value="1">★☆☆☆☆ 1 - Terrible</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Feedback Comment</label>
                <textarea
                  rows={3}
                  value={ratingModal.comment}
                  onChange={(e) => setRatingModal({ ...ratingModal, comment: e.target.value })}
                  placeholder="How was the communication and transfer speed?"
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRatingModal(null)}
                  className="px-4 py-2 text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-xl"
                >
                  Submit Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verified Cinema Pass with Dynamic QR Code Modal */}
      {selectedTicketForPass && (
        <TicketPassModal
          isOpen={Boolean(selectedTicketForPass)}
          onClose={() => setSelectedTicketForPass(null)}
          ticketData={selectedTicketForPass}
        />
      )}
    </div>
  );
};
