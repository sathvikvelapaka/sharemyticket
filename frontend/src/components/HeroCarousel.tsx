import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ShieldCheck, Sparkles, Tag, ArrowRight } from 'lucide-react';

interface HeroCarouselProps {
  onExploreClick?: () => void;
}

export const HeroCarousel: React.FC<HeroCarouselProps> = ({ onExploreClick }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      id: 1,
      title: 'Dune: Part Two (IMAX 4K)',
      subtitle: 'Official Resale Tickets Available • PVR INOX Medchal & Forum Mall',
      badge: 'PROMOTED • 80% PRICE CAP',
      bgGradient: 'from-amber-900 via-orange-950 to-slate-950',
      accentColor: 'text-amber-400',
      cta: 'Buy Verified Pass',
      offer: 'Save ₹150 with Fair Pricing Cap',
    },
    {
      id: 2,
      title: 'TrustPass Authorized Transfer Protocol',
      subtitle: 'Can’t make the movie? Resell safely through official BookMyShow transfer.',
      badge: 'SECURITY GUARANTEED',
      bgGradient: 'from-rose-950 via-slate-900 to-slate-950',
      accentColor: 'text-[#f84464]',
      cta: 'Explore Resale Protocol',
      offer: 'Zero Duplicate Listings • HMAC Fingerprinted',
    },
    {
      id: 3,
      title: 'Ramayana & Interstellar (70mm Experience)',
      subtitle: 'Prasads Multiplex & Nexus Mall • Prime Recliner Seats Available',
      badge: 'EXCLUSIVE VERIFIED PASSES',
      bgGradient: 'from-indigo-950 via-slate-900 to-slate-950',
      accentColor: 'text-teal-400',
      cta: 'View Tickets',
      offer: 'CRED Cashback & Instant UPI Transfer',
    },
  ];

  const handleNext = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const handlePrev = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  useEffect(() => {
    const timer = setInterval(handleNext, 6000);
    return () => clearInterval(timer);
  }, []);

  const slide = slides[currentSlide];

  return (
    <div className="relative w-full bg-[#1a1c23] py-4 sm:py-6 overflow-hidden select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Center Banner Card with partial flanking effect */}
        <div className={`relative rounded-2xl bg-gradient-to-r ${slide.bgGradient} p-6 sm:p-10 text-white shadow-2xl border border-slate-700/60 overflow-hidden min-h-[220px] sm:min-h-[260px] flex flex-col justify-between transition-all duration-500`}>
          {/* Subtle geometric pattern overlay */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]"></div>

          {/* Slide Content */}
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="inline-flex items-center space-x-1.5 bg-black/40 border border-white/20 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{slide.badge}</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
              {slide.title}
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 font-medium">
              {slide.subtitle}
            </p>
          </div>

          {/* Bottom CTA & Highlights */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
            <div className="flex items-center space-x-2 text-xs font-bold text-amber-300">
              <Tag className="w-4 h-4" />
              <span>{slide.offer}</span>
            </div>

            <button
              type="button"
              onClick={onExploreClick}
              className="bg-[#f84464] hover:bg-[#d63653] text-white px-5 py-2.5 rounded-lg text-xs font-bold shadow-lg shadow-[#f84464]/30 flex items-center space-x-1.5 transition transform hover:-translate-y-0.5"
            >
              <span>{slide.cta}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Carousel Arrow Controls */}
        <button
          type="button"
          onClick={handlePrev}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-sm transition border border-white/20 shadow-lg"
          title="Previous Banner"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-sm transition border border-white/20 shadow-lg"
          title="Next Banner"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Slide Indicator Dots */}
        <div className="flex justify-center space-x-1.5 mt-3">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentSlide(idx)}
              className={`h-1.5 rounded-full transition-all ${
                idx === currentSlide ? 'w-6 bg-[#f84464]' : 'w-2 bg-slate-600'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
