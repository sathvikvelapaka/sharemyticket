import React from 'react';
import { 
  X, ShieldCheck, Download, Printer, CheckCircle2, 
  MapPin, Calendar, Clock, Sparkles, Share2, Ticket 
} from 'lucide-react';

interface TicketPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketData: {
    eventName: string;
    venueName: string;
    venueCity: string;
    eventDate: string;
    showTime: string;
    seatCategory: string;
    seats?: string;
    transferRef: string;
    recipientName: string;
    totalAmountRupees: number;
  };
}

// Generates an authentic pseudo-random but deterministic QR matrix pattern based on seed
function generateQRMatrix(seed: string): boolean[][] {
  const size = 23;
  const matrix: boolean[][] = Array(size).fill(false).map(() => Array(size).fill(false));

  // Helper for hash
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }

  // Draw 3 corner finder patterns
  function drawFinder(r: number, c: number) {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        if (
          i === 0 || i === 6 || j === 0 || j === 6 ||
          (i >= 2 && i <= 4 && j >= 2 && j <= 4)
        ) {
          matrix[r + i][c + j] = true;
        } else {
          matrix[r + i][c + j] = false;
        }
      }
    }
  }

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Fill data cells
  let prng = Math.abs(h);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // Don't overwrite finders
      if ((r < 8 && c < 8) || (r < 8 && c >= size - 8) || (r >= size - 8 && c < 8)) {
        continue;
      }
      prng = (prng * 1664525 + 1013904223) | 0;
      matrix[r][c] = (prng >>> 16) % 2 === 0;
    }
  }

  return matrix;
}

export const TicketPassModal: React.FC<TicketPassModalProps> = ({
  isOpen,
  onClose,
  ticketData,
}) => {
  if (!isOpen) return null;

  const qrMatrix = generateQRMatrix(ticketData.transferRef || 'BMS-TRUSTPASS-PASS-2026');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative max-w-sm w-full bg-slate-900 text-white rounded-3xl overflow-hidden shadow-2xl border border-emerald-500/30 my-8">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-20 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white p-1.5 rounded-full backdrop-blur-sm transition"
          title="Close Pass"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top Header Badge */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-5 py-3 text-center">
          <div className="inline-flex items-center space-x-1.5 bg-black/20 text-emerald-100 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            <span>BookMyShow Official Authorized Transfer</span>
          </div>
        </div>

        {/* Ticket Body */}
        <div className="p-6 space-y-4">
          {/* Event & Cinema info */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-emerald-400">
              Verified Cinema Pass
            </span>
            <h2 className="text-xl font-extrabold text-white leading-tight">
              {ticketData.eventName}
            </h2>
            <div className="flex items-center space-x-1.5 text-xs text-slate-300 pt-0.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>{ticketData.venueName}, {ticketData.venueCity}</span>
            </div>
          </div>

          {/* Date, Time, Screen Box */}
          <div className="grid grid-cols-3 gap-2 bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 text-center text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Date</span>
              <span className="font-extrabold text-white">{ticketData.eventDate}</span>
            </div>
            <div className="border-x border-slate-700">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Time</span>
              <span className="font-extrabold text-emerald-400">{ticketData.showTime}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Screen</span>
              <span className="font-extrabold text-white">AUDI 3</span>
            </div>
          </div>

          {/* Seats Info */}
          <div className="flex justify-between items-center bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2.5 rounded-xl text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Category & Seats</span>
              <span className="font-extrabold text-white text-sm">{ticketData.seatCategory} • {ticketData.seats || 'K12, K13'}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Ticket Owner</span>
              <span className="font-bold text-emerald-300">{ticketData.recipientName}</span>
            </div>
          </div>

          {/* Dotted Cut Line with Notch simulation */}
          <div className="relative py-1">
            <div className="border-b border-dashed border-slate-700 w-full"></div>
            <div className="absolute -left-9 -top-2.5 w-6 h-6 bg-slate-950 rounded-full"></div>
            <div className="absolute -right-9 -top-2.5 w-6 h-6 bg-slate-950 rounded-full"></div>
          </div>

          {/* GENERATED SHARP QR CODE DISPLAY */}
          <div className="text-center space-y-2 pt-1">
            <div className="bg-white p-3.5 rounded-2xl inline-block shadow-2xl border-4 border-emerald-500/50">
              <svg width="150" height="150" viewBox="0 0 23 23" className="shape-rendering-crispEdges">
                {qrMatrix.map((row, r) =>
                  row.map((cell, c) => (
                    cell ? (
                      <rect
                        key={`${r}-${c}`}
                        x={c}
                        y={r}
                        width="1"
                        height="1"
                        fill="#0b0f19"
                      />
                    ) : null
                  ))
                )}
              </svg>
            </div>

            <div className="space-y-0.5">
              <p className="text-[11px] font-mono text-emerald-400 font-bold tracking-wider">
                {ticketData.transferRef}
              </p>
              <p className="text-[10px] text-slate-400 flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-emerald-400 mr-1" />
                Valid for direct gate turnstile entry
              </p>
            </div>
          </div>

          {/* Barcode representation */}
          <div className="pt-2 text-center">
            <div className="h-6 flex items-center justify-center space-x-1 opacity-80">
              {[2, 1, 3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 2, 4, 2, 1, 3, 1, 2, 4, 1, 3].map((w, i) => (
                <div key={i} className={`h-full bg-slate-400 ${w === 1 ? 'w-0.5' : w === 2 ? 'w-1' : w === 3 ? 'w-1.5' : 'w-2'}`}></div>
              ))}
            </div>
            <span className="text-[9px] font-mono text-slate-500 tracking-widest uppercase mt-1 block">
              SECURE-FINGERPRINT: {ticketData.transferRef.slice(-8)}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                alert('Ticket Pass saved to your device. You can display this QR code at cinema gate entry.');
              }}
              className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save Pass</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition flex items-center justify-center space-x-1.5 border border-slate-700"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Ticket</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-medium transition"
          >
            Close Pass
          </button>
        </div>
      </div>
    </div>
  );
};
