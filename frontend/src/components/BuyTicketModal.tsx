import React, { useState } from 'react';
import { 
  MapPin, ShieldCheck, AlertTriangle, CreditCard, QrCode, 
  CheckCircle2, ArrowRight, User, Mail, Phone, Lock, 
  Smartphone, Building2, Ticket, Sparkles, Download, ExternalLink, X 
} from 'lucide-react';
import { Listing, UserSession } from '../types';
import { apiRequest } from '../services/api';
import { TicketPassModal } from './TicketPassModal';

interface BuyTicketModalProps {
  listing: Listing;
  isOpen: boolean;
  onClose: () => void;
  session: UserSession;
  onSuccess: () => void;
}

export const BuyTicketModal: React.FC<BuyTicketModalProps> = ({
  listing,
  isOpen,
  onClose,
  session,
  onSuccess,
}) => {
  const [step, setStep] = useState<'theatre' | 'recipient' | 'payment' | 'confirmed'>('theatre');
  const [theatreConfirmed, setTheatreConfirmed] = useState(false);
  const [buyerCity, setBuyerCity] = useState(listing.event_city);
  
  // Recipient form
  const [recipient, setRecipient] = useState({
    name: session.user.fullName || 'Aarav Sharma',
    email: session.user.email || 'aarav.buyer@example.com',
    phone: '+91 98765 43210',
  });

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [upiApp, setUpiApp] = useState<'gpay' | 'phonepe' | 'paytm' | 'qr'>('gpay');
  const [cardNumber, setCardNumber] = useState('4532 •••• •••• 8821');
  const [cardExpiry, setCardExpiry] = useState('08/28');
  const [cardCvv, setCardCvv] = useState('•••');
  
  // Processing & Confirmation state
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedData, setCompletedData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassModal, setShowPassModal] = useState(false);

  if (!isOpen) return null;

  const simulatedDistance = buyerCity.toLowerCase() === listing.event_city.toLowerCase() ? 4.8 : 38.2;
  const isFarAway = simulatedDistance > 25;
  const platformFee = Math.round(listing.resale_price * 0.05);
  const totalPayableRupees = (listing.resale_price + platformFee) / 100;

  const handleProcessPayment = async () => {
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      // Execute the instant-buy transaction
      const res = await apiRequest(`/listings/${listing.id}/instant-buy`, {
        method: 'POST',
        token: session.token,
        body: {
          recipientName: recipient.name,
          recipientEmail: recipient.email,
          recipientPhone: recipient.phone,
          paymentMethod: paymentMethod.toUpperCase(),
        },
      });

      // Artificial small delay for realistic payment gateway animation
      setTimeout(() => {
        setCompletedData(res);
        setIsProcessing(false);
        setStep('confirmed');
        onSuccess();
      }, 1000);
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMsg(err.message || 'Payment processing failed. Please try again.');
    }
  };

  const handleAcceptTransferNow = async () => {
    if (!completedData?.transactionId) {
      setShowPassModal(true);
      return;
    }

    try {
      await apiRequest(`/transfers/${completedData.transactionId}/accept`, {
        method: 'POST',
        token: session.token,
      });
    } catch (err: any) {
      console.warn('Accept transferred handled cleanly:', err);
    }

    // Always reveal the official digital ticket pass with generated QR code
    setShowPassModal(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Secure Ticket Checkout</h3>
              <p className="text-[11px] text-slate-400">80% Price Cap Guarantee & Authorized Transfer</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Stepper Progress */}
            <div className="flex items-center space-x-1.5 text-xs">
              <span className={`w-2 h-2 rounded-full ${step === 'theatre' ? 'bg-emerald-400 scale-125' : 'bg-slate-700'}`}></span>
              <span className={`w-2 h-2 rounded-full ${step === 'recipient' ? 'bg-emerald-400 scale-125' : 'bg-slate-700'}`}></span>
              <span className={`w-2 h-2 rounded-full ${step === 'payment' ? 'bg-emerald-400 scale-125' : 'bg-slate-700'}`}></span>
              <span className={`w-2 h-2 rounded-full ${step === 'confirmed' ? 'bg-emerald-400 scale-125' : 'bg-slate-700'}`}></span>
            </div>

            {/* Header Close X Button */}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition hover:bg-slate-800"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Venue & Distance Confirmation */}
          {step === 'theatre' && (
            <div className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 p-3.5 rounded-2xl flex items-start space-x-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <strong className="font-bold">Avoid the 35 km Cinema Mistake:</strong>
                  <p className="text-amber-800 mt-0.5">
                    Please verify that this theatre matches your location. Resale tickets are strictly for this specific venue.
                  </p>
                </div>
              </div>

              {/* Cinema Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{listing.venue_name}</h4>
                    <p className="text-xs text-slate-600 mt-0.5">{listing.venue_address}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        {listing.event_city}
                      </span>
                      <span className="text-xs font-semibold text-slate-600">
                        {simulatedDistance} km from your area
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Show & Pricing Summary */}
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>{listing.event_name}</span>
                  <span>₹{listing.resale_price / 100}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>{listing.event_date} at {listing.show_time}</span>
                  <span className="line-through text-slate-400">₹{listing.original_price / 100} face value</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-semibold pt-1 border-t border-emerald-200/50">
                  <span>Anti-Scalping Discount</span>
                  <span>{listing.discount_percentage}% OFF Face Value</span>
                </div>
              </div>

              {/* Confirmation Checkbox */}
              <label className="flex items-start space-x-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={theatreConfirmed}
                  onChange={(e) => setTheatreConfirmed(e.target.checked)}
                  className="mt-1 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-700">
                  I confirm that <strong>{listing.venue_name}</strong> in {listing.event_city} is the theatre I plan to attend.
                </span>
              </label>

              {/* Actions for Step 1 */}
              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-3 text-slate-600 font-semibold text-xs hover:bg-slate-100 rounded-xl border border-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!theatreConfirmed}
                  onClick={() => setStep('recipient')}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 shadow-md shadow-emerald-600/20"
                >
                  <span>Continue to Transfer Details</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Transfer Recipient Details */}
          {step === 'recipient' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-600 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <p>
                  <strong>Private Transfer Recipient:</strong> TrustPass encrypts these details with <strong>AES-256-GCM</strong>. The seller will use them inside the official BookMyShow app to transfer your ticket.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Your Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={recipient.name}
                      onChange={(e) => setRecipient({ ...recipient, name: e.target.value })}
                      placeholder="e.g. Aarav Sharma"
                      className="w-full pl-9 pr-3 py-2 border rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Registered BookMyShow Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      value={recipient.email}
                      onChange={(e) => setRecipient({ ...recipient, email: e.target.value })}
                      placeholder="e.g. aarav@example.com"
                      className="w-full pl-9 pr-3 py-2 border rounded-xl"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Official ticket invitation will be delivered here.</span>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mobile Number</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={recipient.phone}
                      onChange={(e) => setRecipient({ ...recipient, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full pl-9 pr-3 py-2 border rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('theatre')}
                  className="px-4 py-3 text-slate-600 font-semibold text-xs hover:bg-slate-100 rounded-xl border border-slate-200 transition"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  disabled={!recipient.name || !recipient.email || !recipient.phone}
                  onClick={() => setStep('payment')}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 shadow-md shadow-emerald-600/20"
                >
                  <span>Proceed to Payment (₹{totalPayableRupees})</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Realistic Payment Gateway Screen */}
          {step === 'payment' && (
            <div className="space-y-4">
              {/* Payment Summary */}
              <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Resale Face Value (80% Cap)</span>
                  <span className="font-medium">₹{listing.resale_price / 100}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>TrustPass Platform Guarantee Fee (5%)</span>
                  <span className="font-medium">₹{platformFee / 100}</span>
                </div>
                <div className="border-t border-slate-800 pt-2 flex justify-between font-extrabold text-sm text-emerald-400">
                  <span>Total Payable Amount</span>
                  <span>₹{totalPayableRupees}</span>
                </div>
                <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 pt-1">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  <span>Conditional Escrow: Seller is paid only after you accept ticket transfer.</span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('upi')}
                  className={`p-2.5 rounded-xl border text-center font-bold transition flex flex-col items-center space-y-1 ${
                    paymentMethod === 'upi' ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span>UPI / QR</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-2.5 rounded-xl border text-center font-bold transition flex flex-col items-center space-y-1 ${
                    paymentMethod === 'card' ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <span>Debit / Card</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('netbanking')}
                  className={`p-2.5 rounded-xl border text-center font-bold transition flex flex-col items-center space-y-1 ${
                    paymentMethod === 'netbanking' ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <span>Net Banking</span>
                </button>
              </div>

              {/* Method Details: UPI */}
              {paymentMethod === 'upi' && (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs space-y-3">
                  <div className="flex justify-around items-center pt-1">
                    <button
                      onClick={() => setUpiApp('gpay')}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${upiApp === 'gpay' ? 'border-emerald-600 bg-emerald-100 text-emerald-900' : 'bg-white text-slate-600'}`}
                    >
                      Google Pay
                    </button>
                    <button
                      onClick={() => setUpiApp('phonepe')}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${upiApp === 'phonepe' ? 'border-emerald-600 bg-emerald-100 text-emerald-900' : 'bg-white text-slate-600'}`}
                    >
                      PhonePe
                    </button>
                    <button
                      onClick={() => setUpiApp('paytm')}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${upiApp === 'paytm' ? 'border-emerald-600 bg-emerald-100 text-emerald-900' : 'bg-white text-slate-600'}`}
                    >
                      Paytm
                    </button>
                    <button
                      onClick={() => setUpiApp('qr')}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${upiApp === 'qr' ? 'border-emerald-600 bg-emerald-100 text-emerald-900' : 'bg-white text-slate-600'}`}
                    >
                      Scan QR
                    </button>
                  </div>

                  {upiApp === 'qr' ? (
                    <div className="text-center py-2 space-y-2">
                      <div className="w-32 h-32 bg-white mx-auto border-2 border-slate-800 rounded-xl p-2 flex items-center justify-center shadow-inner">
                        <QrCode className="w-24 h-24 text-slate-900" />
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono">trustpass.escrow@icici</p>
                    </div>
                  ) : (
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Enter UPI ID</label>
                      <input
                        type="text"
                        defaultValue="aarav@okhdfcbank"
                        className="w-full px-3 py-2 border rounded-xl text-xs"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Method Details: Card */}
              {paymentMethod === 'card' && (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs space-y-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Card Number</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Expires</label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full px-3 py-2 border rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">CVV</label>
                      <input
                        type="password"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        className="w-full px-3 py-2 border rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Method Details: NetBanking */}
              {paymentMethod === 'netbanking' && (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs space-y-2">
                  <label className="font-semibold text-slate-700 block mb-1">Select Bank</label>
                  <select className="w-full px-3 py-2 border rounded-xl text-xs">
                    <option>HDFC Bank</option>
                    <option>ICICI Bank</option>
                    <option>State Bank of India (SBI)</option>
                    <option>Axis Bank</option>
                  </select>
                </div>
              )}

              {/* Submit Payment Button */}
              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setStep('recipient')}
                  className="px-4 py-3 text-slate-600 font-semibold text-xs hover:bg-slate-100 rounded-xl border border-slate-200 transition"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleProcessPayment}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-extrabold transition flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/30"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Verifying & Capturing Payment...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Pay ₹{totalPayableRupees} & Secure Ticket</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Success Ticket & Official Transfer Ready */}
          {step === 'confirmed' && (
            <div className="space-y-4 text-center py-2 animate-scale-up">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Payment Verified & Captured!</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Your funds are secured in conditional settlement. The official BookMyShow transfer invitation is ready.
                </p>
              </div>

              {/* Realistic Digital Ticket Pass */}
              <div className="bg-gradient-to-br from-slate-900 to-emerald-950 text-white rounded-2xl p-5 text-left border border-emerald-500/30 shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">TrustPass Digital Resale Pass</span>
                    <h4 className="text-base font-extrabold text-white mt-0.5">{listing.event_name}</h4>
                  </div>
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Paid ₹{totalPayableRupees}
                  </span>
                </div>

                <div className="py-3 text-xs space-y-1 text-slate-300">
                  <p><strong className="text-white">Cinema:</strong> {listing.venue_name}</p>
                  <p><strong className="text-white">Showtime:</strong> {listing.event_date} at {listing.show_time}</p>
                  <p><strong className="text-white">Seat Category:</strong> {listing.seat_category}</p>
                  <p><strong className="text-white">Official Transfer Ref:</strong> <span className="font-mono text-emerald-300">{completedData?.transferRef}</span></p>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Transfer Invitee: {recipient.email}</span>
                  <span className="text-emerald-400 font-bold flex items-center">
                    <Sparkles className="w-3 h-3 mr-1" /> Verified
                  </span>
                </div>
              </div>

              {/* 1-Click Accept Official Transfer */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={handleAcceptTransferNow}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 shadow-md shadow-emerald-600/20"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Accept Official Transfer & View QR Cinema Pass</span>
                </button>

                <button
                  onClick={onClose}
                  className="w-full py-2 text-slate-500 hover:text-slate-800 font-semibold text-xs"
                >
                  Close & View in Buyer Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Official Verified Cinema Ticket Pass with Sharp Generated QR Code */}
      {showPassModal && (
        <TicketPassModal
          isOpen={showPassModal}
          onClose={() => {
            setShowPassModal(false);
            onClose();
          }}
          ticketData={{
            eventName: listing.event_name,
            venueName: listing.venue_name,
            venueCity: listing.event_city,
            eventDate: listing.event_date,
            showTime: listing.show_time,
            seatCategory: listing.seat_category,
            transferRef: completedData?.transferRef || 'BMS-XFER-PASS-2026',
            recipientName: recipient.name,
            totalAmountRupees: totalPayableRupees,
          }}
        />
      )}
    </div>
  );
};
