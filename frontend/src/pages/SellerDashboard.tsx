import React, { useState, useEffect } from 'react';
import { 
  Store, PlusCircle, CheckCircle2, XCircle, Send, ShieldCheck, 
  AlertCircle, Upload, DollarSign, Clock, Users, ArrowUpRight 
} from 'lucide-react';
import { UserSession, PurchaseRequest, Listing } from '../types';
import { apiRequest } from '../services/api';

interface SellerDashboardProps {
  session: UserSession;
}

export const SellerDashboard: React.FC<SellerDashboardProps> = ({ session }) => {
  const [activeTab, setActiveTab] = useState<'listings' | 'requests' | 'create'>('requests');
  const [listings, setListings] = useState<Listing[]>([]);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [recipientData, setRecipientData] = useState<Record<string, { fullName: string; email: string; phone: string }>>({});
  const [loading, setLoading] = useState(true);
  const [venues, setVenues] = useState<any[]>([]);

  // Listing Form State
  const [formData, setFormData] = useState({
    providerId: 'provider-bms',
    eventName: '',
    eventCategory: 'Movie',
    eventDate: new Date().toISOString().split('T')[0],
    showTime: '07:30 PM',
    city: 'Hyderabad',
    venueId: '',
    seatCategory: 'Prime Recliner',
    seatIdentifiers: 'J14, J15',
    quantity: 2,
    originalPriceRupees: 500,
    resalePriceRupees: 350,
    bookingReference: '',
  });

  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const maxAllowedPrice = Math.floor(formData.originalPriceRupees * 0.80);
  const isOverpriced = formData.resalePriceRupees > maxAllowedPrice;

  const fetchSellerData = async () => {
    setLoading(true);
    try {
      const [reqData, listingsData, venuesRes] = await Promise.all([
        apiRequest('/seller/requests', { token: session.token }),
        apiRequest('/listings', { token: session.token }),
        fetch('/api/v1/venues').then((r) => r.json()).catch(() => ({ venues: [] })),
      ]);

      setRequests(reqData.requests || []);
      setVenues(venuesRes.venues || []);
      
      // Filter listings for this seller
      const sellerListings = (listingsData.listings || []).filter(
        (l: any) => l.seller_id === session.user.id
      );
      setListings(sellerListings);

      if (venuesRes.venues && venuesRes.venues.length > 0 && !formData.venueId) {
        setFormData((prev) => ({ ...prev, venueId: venuesRes.venues[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSellerData();
  }, [session.token]);

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionMessage(null);

    if (isOverpriced) {
      setActionMessage({
        type: 'error',
        text: `Fair Pricing Policy Violation: Resale price (₹${formData.resalePriceRupees}) exceeds the platform maximum allowed 80% limit (₹${maxAllowedPrice}).`,
      });
      return;
    }

    try {
      const payload = {
        ...formData,
        originalPrice: formData.originalPriceRupees * 100, // convert to paise
        resalePrice: formData.resalePriceRupees * 100,
      };

      const res = await apiRequest('/listings', {
        method: 'POST',
        token: session.token,
        body: payload,
      });

      // If evidence file attached, upload it
      if (evidenceFile && res.listingId) {
        const fileFormData = new FormData();
        fileFormData.append('evidence', evidenceFile);
        await apiRequest(`/listings/${res.listingId}/evidence`, {
          method: 'POST',
          token: session.token,
          body: fileFormData,
          isFormData: true,
        });
      }

      setActionMessage({
        type: 'success',
        text: 'Ticket listing created successfully! Price verified under 80% rule, and duplicate protection verified.',
      });

      setActiveTab('listings');
      fetchSellerData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      await apiRequest(`/requests/${requestId}/accept`, {
        method: 'POST',
        token: session.token,
      });

      setActionMessage({
        type: 'success',
        text: 'Request accepted! Listing atomically locked and reserved for 10 minutes for this buyer.',
      });
      fetchSellerData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await apiRequest(`/requests/${requestId}/reject`, {
        method: 'POST',
        token: session.token,
      });

      setActionMessage({ type: 'success', text: 'Request declined. Listing remains active.' });
      fetchSellerData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleViewRecipient = async (transactionId: string) => {
    try {
      const res = await apiRequest(`/transactions/${transactionId}/recipient`, {
        token: session.token,
      });
      setRecipientData((prev) => ({ ...prev, [transactionId]: res.recipient }));
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleInitiateTransfer = async (transactionId: string) => {
    try {
      const res = await apiRequest('/transfers/initiate', {
        method: 'POST',
        token: session.token,
        body: { transactionId },
      });

      setActionMessage({
        type: 'success',
        text: `Official transfer initiated through BookMyShow adapter! Ref: ${res.providerTransferReference}. Buyer notified to accept.`,
      });
      fetchSellerData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
            Authenticated as Seller
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1">Seller Hub & Settlement Center</h1>
          <p className="text-sm text-slate-500">List unwanted tickets with fair pricing enforcement, review buyer requests, and coordinate authorized transfers.</p>
        </div>

        <button
          onClick={() => setActiveTab('create')}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs shadow-sm transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create Ticket Listing</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('requests')}
          className={`pb-3 px-3 transition border-b-2 flex items-center space-x-1.5 ${
            activeTab === 'requests'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Incoming Requests ({requests.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('listings')}
          className={`pb-3 px-3 transition border-b-2 flex items-center space-x-1.5 ${
            activeTab === 'listings'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>My Listings ({listings.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('create')}
          className={`pb-3 px-3 transition border-b-2 flex items-center space-x-1.5 ${
            activeTab === 'create'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create Listing</span>
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
          {actionMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* TAB 1: Incoming Buyer Requests */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {requests.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
              <Users className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">No incoming buyer requests</h3>
              <p className="text-xs text-slate-500">When buyers view your listings and click "Request Ticket", you can review and accept them here.</p>
            </div>
          ) : (
            requests.map((req) => (
              <div key={req.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-bold text-slate-900">{req.event_name}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        req.request_status === 'accepted' ? 'bg-emerald-100 text-emerald-800' :
                        req.request_status === 'pending' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {req.request_status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Requested by: <strong className="text-slate-800">{req.buyer_name}</strong> • Quantity: {req.requested_quantity}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-lg font-extrabold text-slate-900">₹{req.resale_price / 100}</span>
                    <span className="text-[11px] text-slate-400 block">Payout upon verified transfer</span>
                  </div>
                </div>

                {/* Actions depending on request state */}
                {req.request_status === 'pending' && (
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleApproveRequest(req.id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Accept & Reserve Listing (10 min)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectRequest(req.id)}
                      className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition border border-slate-200"
                    >
                      Decline
                    </button>
                  </div>
                )}

                {/* If approved, show transfer coordination actions */}
                {req.request_status === 'accepted' && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">Official Transfer Workflow</span>
                      <span className="text-[11px] text-slate-500">Provider: BookMyShow</span>
                    </div>

                    {/* View Recipient Details */}
                    {req.transaction_id && (
                      <div className="space-y-2">
                        {recipientData[req.transaction_id] ? (
                          <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                            <span className="font-bold text-emerald-800 block">Decrypted Recipient Transfer Info:</span>
                            <p><strong>Name:</strong> {recipientData[req.transaction_id].fullName}</p>
                            <p><strong>Email:</strong> {recipientData[req.transaction_id].email}</p>
                            <p><strong>Mobile:</strong> {recipientData[req.transaction_id].phone}</p>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleViewRecipient(req.transaction_id!)}
                            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 underline"
                          >
                            Click to Decrypt Buyer Recipient Information
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleInitiateTransfer(req.transaction_id!)}
                          className="px-4 py-2 bg-slate-900 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm"
                        >
                          <Send className="w-4 h-4" />
                          <span>Initiate Official BookMyShow Transfer</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: My Listings */}
      {activeTab === 'listings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((l) => (
            <div key={l.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-slate-900">{l.event_name}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  l.listing_status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                  l.listing_status === 'reserved' ? 'bg-amber-100 text-amber-800' :
                  l.listing_status === 'sold' ? 'bg-indigo-100 text-indigo-800' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {l.listing_status}
                </span>
              </div>
              <p className="text-xs text-slate-500">{l.venue_name} • {l.show_time}</p>
              <div className="flex justify-between items-baseline pt-2 border-t">
                <div>
                  <span className="text-xs text-slate-400 line-through">₹{l.original_price / 100}</span>
                  <div className="text-lg font-extrabold text-slate-900">₹{l.resale_price / 100}</div>
                </div>
                <span className="text-xs font-bold text-emerald-600">{l.discount_percentage}% OFF</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: Create Listing Wizard */}
      {activeTab === 'create' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm max-w-2xl mx-auto space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">List Your Movie or Event Ticket</h3>
            <p className="text-xs text-slate-500 mt-1">
              TrustPass verifies original BookMyShow booking reference fingerprints and strictly enforces the <strong>80% maximum fair pricing cap</strong> to stop scalpers.
            </p>
          </div>

          <form onSubmit={handleCreateListing} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Movie / Event Name</label>
              <input
                type="text"
                required
                value={formData.eventName}
                onChange={(e) => setFormData({ ...formData, eventName: e.target.value })}
                placeholder="e.g. Interstellar (70mm Experience)"
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">City</label>
                <select
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                >
                  <option value="Hyderabad">Hyderabad</option>
                  <option value="Bangalore">Bangalore</option>
                  <option value="Mumbai">Mumbai</option>
                  <option value="Delhi">Delhi</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Cinema Venue</label>
                <select
                  value={formData.venueId}
                  onChange={(e) => setFormData({ ...formData, venueId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                >
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.venue_name} ({v.city})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Show Date</label>
                <input
                  type="date"
                  required
                  value={formData.eventDate}
                  onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Show Time</label>
                <input
                  type="text"
                  required
                  value={formData.showTime}
                  onChange={(e) => setFormData({ ...formData, showTime: e.target.value })}
                  placeholder="e.g. 09:00 PM"
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Original Price (₹)</label>
                <input
                  type="number"
                  required
                  value={formData.originalPriceRupees}
                  onChange={(e) => setFormData({ ...formData, originalPriceRupees: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-slate-700">Resale Price (₹)</label>
                  <span className="text-[10px] font-bold text-emerald-700">Max 80%: ₹{maxAllowedPrice}</span>
                </div>
                <input
                  type="number"
                  required
                  value={formData.resalePriceRupees}
                  onChange={(e) => setFormData({ ...formData, resalePriceRupees: parseInt(e.target.value, 10) || 0 })}
                  className={`w-full px-3 py-2 border rounded-xl ${isOverpriced ? 'border-rose-500 bg-rose-50 text-rose-800' : ''}`}
                />
                {isOverpriced && (
                  <span className="text-[11px] text-rose-600 block mt-1 font-semibold">
                    Exceeds 80% maximum cap! Lower price to ₹{maxAllowedPrice} or below.
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Original Booking Reference (BookMyShow / Paytm)</label>
              <input
                type="text"
                required
                value={formData.bookingReference}
                onChange={(e) => setFormData({ ...formData, bookingReference: e.target.value })}
                placeholder="e.g. BMS-HYD-58219"
                className="w-full px-3 py-2 border rounded-xl"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Stored as an HMAC-SHA256 fingerprint. Never exposed publicly to buyers.
              </span>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Private Ticket Evidence (PDF or Image)</label>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setEvidenceFile(e.target.files ? e.target.files[0] : null)}
                className="w-full text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              />
            </div>

            <button
              type="submit"
              disabled={isOverpriced}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl font-semibold transition shadow-md shadow-emerald-600/20 text-xs"
            >
              Submit Ticket Listing
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
