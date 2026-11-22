import React, { useState } from 'react';
import { MapPin, AlertTriangle, ShieldCheck, CheckCircle2, Navigation, X } from 'lucide-react';
import { Listing } from '../types';

interface WrongTheatreModalProps {
  listing: Listing;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  actionLabel?: string;
}

export const WrongTheatreModal: React.FC<WrongTheatreModalProps> = ({
  listing,
  isOpen,
  onClose,
  onConfirm,
  actionLabel = 'Proceed to Request Ticket',
}) => {
  const [buyerCity, setBuyerCity] = useState(listing.event_city);
  const [confirmed, setConfirmed] = useState(false);

  if (!isOpen) return null;

  // Approximate distance calculation based on cities / locations
  const isDifferentCity = buyerCity.toLowerCase() !== listing.event_city.toLowerCase();
  const simulatedDistance = isDifferentCity ? 38.5 : 4.2; // km

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100">
        {/* Header Warning */}
        <div className="bg-amber-500 text-white p-5 flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-7 h-7 text-amber-100 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-bold">Venue & Location Confirmation</h3>
              <p className="text-amber-100 text-sm mt-0.5">
                Avoid travelling to the wrong cinema! Please confirm your theatre destination.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-amber-200 hover:text-white p-1 rounded-lg transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Target Venue Details */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <MapPin className="w-5 h-5 text-emerald-600 mt-1 flex-shrink-0" />
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Destination Theatre</span>
                <h4 className="text-base font-bold text-slate-900 mt-0.5">{listing.venue_name}</h4>
                <p className="text-sm text-slate-600 mt-1">{listing.venue_address}</p>
                <div className="flex items-center space-x-2 mt-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    {listing.event_city}
                  </span>
                  <span className="inline-flex items-center text-xs font-medium text-slate-500">
                    <Navigation className="w-3.5 h-3.5 mr-1" />
                    Approx. {simulatedDistance} km from your selected area
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Distance Alert Box if far away */}
          {simulatedDistance > 25 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-800 flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0" />
              <span>
                <strong>Warning:</strong> This theatre is more than 35 km away from your area. Please double check before purchasing non-cancellable resale tickets!
              </span>
            </div>
          )}

          {/* Simulated Map Preview Box */}
          <div className="relative h-32 bg-slate-200 rounded-xl overflow-hidden border border-slate-300 flex items-center justify-center">
            <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#16a34a_1px,transparent_1px)] [background-size:16px_16px]"></div>
            <div className="relative text-center z-10 px-4">
              <MapPin className="w-8 h-8 text-rose-600 mx-auto animate-bounce" />
              <p className="text-xs font-bold text-slate-800 mt-1">{listing.venue_name}</p>
              <p className="text-[11px] text-slate-500">GPS: {listing.venue_lat}, {listing.venue_lng}</p>
            </div>
          </div>

          {/* User Confirmation Checkbox */}
          <label className="flex items-start space-x-3 p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
            />
            <span className="text-xs text-slate-700 leading-relaxed">
              I verify that <strong>{listing.venue_name}</strong> in <strong>{listing.event_city}</strong> is the exact cinema I want to visit for <strong>{listing.event_name}</strong> on <strong>{listing.event_date}</strong> at <strong>{listing.show_time}</strong>.
            </span>
          </label>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!confirmed}
            onClick={() => {
              if (confirmed) {
                onConfirm();
                onClose();
              }
            }}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{actionLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
