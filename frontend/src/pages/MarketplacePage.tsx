import React, { useState, useEffect } from 'react';
import { 
  Search, MapPin, Calendar, Clock, Ticket, ShieldCheck, Tag, 
  AlertCircle, ChevronDown, ChevronUp, Star, Sparkles, Filter, 
  ArrowRight, CheckCircle2, ShoppingBag, Info, HelpCircle 
} from 'lucide-react';
import { Listing, UserSession } from '../types';
import { apiRequest } from '../services/api';
import { HeroCarousel } from '../components/HeroCarousel';
import { BuyTicketModal } from '../components/BuyTicketModal';
import { WrongTheatreModal } from '../components/WrongTheatreModal';

interface MarketplacePageProps {
  session: UserSession;
  onNavigateToBuyer: () => void;
  selectedCity: string;
  searchQuery: string;
}

// Complete movie catalogue matching BookMyShow Medchal listings
const BOOKMYSHOW_CATALOGUE = [
  {
    id: 'movie-party-animals',
    title: 'Party Animals',
    rating: '9.2/10',
    votes: '420+ Votes',
    cbfc: 'A',
    languages: 'Hindi',
    genre: 'Comedy, Drama',
    format: '2D',
    isPromoted: true,
    posterColor: 'from-fuchsia-900 via-purple-950 to-slate-950',
    venue: 'PVR Forum Sujana Mall, Kukatpally',
    city: 'Medchal',
    showTime: '07:30 PM',
    originalPrice: 50000,
    resalePrice: 35000,
  },
  {
    id: 'movie-ene-repeat',
    title: 'ENE Repeat',
    rating: '9.2/10',
    votes: '18K+ Votes',
    cbfc: 'UA16+',
    languages: 'Telugu',
    genre: 'Action, Thriller',
    format: '2D',
    posterColor: 'from-amber-900 via-rose-950 to-slate-950',
    venue: 'Sree Ramulu Theatre, Medchal',
    city: 'Medchal',
    showTime: '06:00 PM',
    originalPrice: 40000,
    resalePrice: 30000,
  },
  {
    id: 'movie-dune-two',
    title: 'Dune: Part Two',
    rating: '9.4/10',
    votes: '45K+ Votes',
    cbfc: 'UA16+',
    languages: 'English',
    genre: 'Sci-Fi, Adventure',
    format: 'IMAX 4K',
    posterColor: 'from-amber-800 via-stone-900 to-black',
    venue: 'Prasads Multiplex Large Screen',
    city: 'Hyderabad',
    showTime: '08:15 PM',
    originalPrice: 60000,
    resalePrice: 45000,
  },
  {
    id: 'movie-aot',
    title: 'AOT (Attack on Titan)',
    rating: '9.5/10',
    votes: '3.3K+ Votes',
    cbfc: 'UA13+',
    languages: 'Tamil, Malayalam',
    genre: 'Animation, Action',
    format: '2D',
    posterColor: 'from-red-950 via-slate-900 to-black',
    venue: 'Cinepolis GSM Mall, Miyapur',
    city: 'Medchal',
    showTime: '09:00 PM',
    originalPrice: 35000,
    resalePrice: 25000,
  },
  {
    id: 'movie-dnk',
    title: 'DNK',
    rating: '8.6/10',
    votes: '8.6K+ Votes',
    cbfc: 'UA16+',
    languages: 'Telugu',
    genre: 'Drama, Romance',
    format: '2D',
    posterColor: 'from-blue-950 via-indigo-950 to-slate-950',
    venue: 'INOX GVK One, Banjara Hills',
    city: 'Hyderabad',
    showTime: '04:30 PM',
    originalPrice: 45000,
    resalePrice: 32000,
  },
  {
    id: 'movie-aakasamlo',
    title: 'Aakasamlo Oka Tara',
    rating: '9.6/10',
    votes: '9.6K+ Votes',
    cbfc: 'UA13+',
    languages: 'Telugu',
    genre: 'Drama',
    format: '2D',
    posterColor: 'from-teal-950 via-cyan-950 to-black',
    venue: 'Asian Mukta A2, Medchal',
    city: 'Medchal',
    showTime: '07:00 PM',
    originalPrice: 30000,
    resalePrice: 24000,
  },
  {
    id: 'movie-ramayana',
    title: 'Ramayana',
    rating: '9.2/10',
    votes: '473K+ Votes',
    cbfc: 'U',
    languages: 'Hindi, Telugu, Tamil',
    genre: 'Mythology, Action',
    format: '3D',
    posterColor: 'from-orange-950 via-amber-950 to-black',
    venue: 'PVR Nexus Mall, Koramangala',
    city: 'Bangalore',
    showTime: '06:30 PM',
    originalPrice: 55000,
    resalePrice: 40000,
  },
  {
    id: 'movie-interstellar',
    title: 'Interstellar (70mm Experience)',
    rating: '9.8/10',
    votes: '120K+ Votes',
    cbfc: 'UA13+',
    languages: 'English',
    genre: 'Sci-Fi, Drama',
    format: '70mm',
    posterColor: 'from-slate-900 via-indigo-950 to-black',
    venue: 'Prasads Multiplex Large Screen',
    city: 'Hyderabad',
    showTime: '08:45 PM',
    originalPrice: 50000,
    resalePrice: 38000,
  },
  {
    id: 'movie-godzilla',
    title: 'Godzilla Minus Zero',
    rating: '9.0/10',
    votes: '3.1K+ Votes',
    cbfc: 'UA16+',
    languages: 'Japanese, English',
    genre: 'Action, Sci-Fi',
    format: 'IMAX 2D',
    posterColor: 'from-emerald-950 via-stone-950 to-black',
    venue: 'PVR Oberoi Mall, Goregaon',
    city: 'Mumbai',
    showTime: '05:15 PM',
    originalPrice: 65000,
    resalePrice: 48000,
  },
  {
    id: 'movie-aadi-anant',
    title: 'Aadi Anant',
    rating: '9.3/10',
    votes: '2.5K+ Votes',
    cbfc: 'UA13+',
    languages: 'Marathi',
    genre: 'Drama',
    format: '2D',
    posterColor: 'from-violet-950 via-slate-950 to-black',
    venue: 'Cinepolis Centre Square, Kochi',
    city: 'Medchal',
    showTime: '03:45 PM',
    originalPrice: 35000,
    resalePrice: 25000,
  },
  {
    id: 'movie-pyre',
    title: 'Pyre',
    rating: '9.5/10',
    votes: '4.2K+ Votes',
    cbfc: 'U',
    languages: 'Hindi',
    genre: 'Thriller',
    format: '2D',
    posterColor: 'from-rose-950 via-red-950 to-black',
    venue: 'PVR Select CITYWALK, Saket',
    city: 'Delhi',
    showTime: '09:30 PM',
    originalPrice: 45000,
    resalePrice: 35000,
  },
  {
    id: 'movie-kankana',
    title: 'Kankana',
    rating: '9.1/10',
    votes: '35+ Votes',
    cbfc: 'A',
    languages: 'Odia',
    genre: 'Drama',
    format: '2D',
    posterColor: 'from-amber-950 via-slate-900 to-black',
    venue: 'PVR Forum Sujana Mall',
    city: 'Hyderabad',
    showTime: '01:30 PM',
    originalPrice: 30000,
    resalePrice: 22000,
  },
];

export const MarketplacePage: React.FC<MarketplacePageProps> = ({
  session,
  onNavigateToBuyer,
  selectedCity,
  searchQuery,
}) => {
  // Filter States
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<string>('');
  
  // Accordion Expand/Collapse States
  const [isLanguagesOpen, setIsLanguagesOpen] = useState(true);
  const [isGenresOpen, setIsGenresOpen] = useState(false);
  const [isFormatOpen, setIsFormatOpen] = useState(false);

  // Modals
  const [selectedListingForBuy, setSelectedListingForBuy] = useState<any | null>(null);
  const [selectedListingForRequest, setSelectedListingForRequest] = useState<any | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  const languagesList = [
    'Telugu', 'Hindi', 'English', 'Tamil', 'Malayalam', 
    'Kannada', 'Marathi', 'Odia', 'Japanese', 'Gujarati', 'Punjabi', 'Bengali'
  ];

  const genresList = [
    'Action', 'Drama', 'Comedy', 'Thriller', 'Sci-Fi', 
    'Romantic', 'Adventure', 'Animation', 'Mythology'
  ];

  const formatsList = [
    '2D', '3D', 'IMAX 4K', 'IMAX 2D', '4DX', '70mm'
  ];

  // Filter items based on user selection
  const filteredMovies = BOOKMYSHOW_CATALOGUE.filter((item) => {
    // City match (Medchal / Hyderabad overlap)
    if (selectedCity && selectedCity !== 'Medchal' && selectedCity !== 'Hyderabad') {
      if (item.city.toLowerCase() !== selectedCity.toLowerCase()) return false;
    }

    // Search query match
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Language match
    if (selectedLanguage && !item.languages.toLowerCase().includes(selectedLanguage.toLowerCase())) {
      return false;
    }

    // Genre match
    if (selectedGenre && !item.genre.toLowerCase().includes(selectedGenre.toLowerCase())) {
      return false;
    }

    // Format match
    if (selectedFormat && !item.format.toLowerCase().includes(selectedFormat.toLowerCase())) {
      return false;
    }

    return true;
  });

  const handleOpenBuy = (item: any) => {
    // Convert to Listing interface shape for BuyTicketModal
    const listingShape: Listing = {
      id: item.id === 'movie-dune-two' ? 'listing-101' : 'listing-102',
      ticket_id: 'ticket-101',
      seller_id: 'user-seller-1',
      seller_name: 'Vikram Reddy (Verified Seller)',
      event_id: 'event-101',
      event_name: item.title,
      event_category: 'Movie',
      event_date: '2026-12-01',
      event_city: item.city,
      venue_id: 'venue-101',
      venue_name: item.venue,
      venue_city: item.city,
      venue_address: `${item.venue}, ${item.city}`,
      venue_lat: 17.4842,
      venue_lng: 78.3889,
      seat_category: 'Prime Recliner',
      quantity: 2,
      original_price: item.originalPrice,
      resale_price: item.resalePrice,
      listing_status: 'active',
      show_time: item.showTime,
      expires_at: '2026-12-01T23:59:59Z',
      provider_name: 'BookMyShow (Simulated Adapter)',
      discount_percentage: Math.round(((item.originalPrice - item.resalePrice) * 100) / item.originalPrice),
      priceBreakdown: {
        originalPrice: item.originalPrice,
        resalePrice: item.resalePrice,
        savings: item.originalPrice - item.resalePrice,
        discountPercentage: Math.round(((item.originalPrice - item.resalePrice) * 100) / item.originalPrice),
        platformFee: Math.round(item.resalePrice * 0.05),
        totalPayable: item.resalePrice + Math.round(item.resalePrice * 0.05),
      },
    };

    setSelectedListingForBuy(listingShape);
  };

  const handleOpenRequest = (item: any) => {
    handleOpenBuy(item);
  };

  return (
    <div className="bg-[#f5f5f7] min-h-screen text-[#333]">
      {/* 2. Hero Promotional Carousel */}
      <HeroCarousel onExploreClick={() => {
        const el = document.getElementById('movie-feed');
        el?.scrollIntoView({ behavior: 'smooth' });
      }} />

      {/* 3. Main Content Area (2-Column Asymmetric Grid) */}
      <div id="movie-feed" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          {/* ================= LEFT SIDEBAR: FILTERS (~25% width) ================= */}
          <aside className="w-full lg:w-72 flex-shrink-0 space-y-4">
            <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center">
                <Filter className="w-4 h-4 mr-2 text-[#f84464]" />
                Filters
              </h2>
              {(selectedLanguage || selectedGenre || selectedFormat) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLanguage('');
                    setSelectedGenre('');
                    setSelectedFormat('');
                  }}
                  className="text-xs text-[#f84464] font-semibold hover:underline"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Accordion Filter 1: Languages (Expanded by default) */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden text-xs">
              <div 
                onClick={() => setIsLanguagesOpen(!isLanguagesOpen)}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition"
              >
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-800">Languages</span>
                  {selectedLanguage && (
                    <span className="bg-[#f84464]/10 text-[#f84464] px-1.5 py-0.5 rounded text-[10px] font-bold">
                      1
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {selectedLanguage && (
                    <span 
                      onClick={(e) => { e.stopPropagation(); setSelectedLanguage(''); }}
                      className="text-[11px] text-[#f84464] font-medium hover:underline"
                    >
                      Clear
                    </span>
                  )}
                  {isLanguagesOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>

              {isLanguagesOpen && (
                <div className="px-4 pb-4 pt-1 flex flex-wrap gap-1.5 border-t border-slate-100">
                  {languagesList.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setSelectedLanguage(selectedLanguage === lang ? '' : lang)}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition ${
                        selectedLanguage === lang
                          ? 'border-[#f84464] bg-[#f84464] text-white shadow-sm'
                          : 'border-slate-200 text-[#f84464] hover:bg-rose-50/60'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Accordion Filter 2: Genres */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden text-xs">
              <div 
                onClick={() => setIsGenresOpen(!isGenresOpen)}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition"
              >
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-800">Genres</span>
                  {selectedGenre && (
                    <span className="bg-[#f84464]/10 text-[#f84464] px-1.5 py-0.5 rounded text-[10px] font-bold">
                      1
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {selectedGenre && (
                    <span 
                      onClick={(e) => { e.stopPropagation(); setSelectedGenre(''); }}
                      className="text-[11px] text-[#f84464] font-medium hover:underline"
                    >
                      Clear
                    </span>
                  )}
                  {isGenresOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>

              {isGenresOpen && (
                <div className="px-4 pb-4 pt-1 flex flex-wrap gap-1.5 border-t border-slate-100">
                  {genresList.map((genre) => (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => setSelectedGenre(selectedGenre === genre ? '' : genre)}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition ${
                        selectedGenre === genre
                          ? 'border-[#f84464] bg-[#f84464] text-white shadow-sm'
                          : 'border-slate-200 text-[#f84464] hover:bg-rose-50/60'
                      }`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Accordion Filter 3: Format */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden text-xs">
              <div 
                onClick={() => setIsFormatOpen(!isFormatOpen)}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition"
              >
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-800">Format</span>
                  {selectedFormat && (
                    <span className="bg-[#f84464]/10 text-[#f84464] px-1.5 py-0.5 rounded text-[10px] font-bold">
                      1
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {selectedFormat && (
                    <span 
                      onClick={(e) => { e.stopPropagation(); setSelectedFormat(''); }}
                      className="text-[11px] text-[#f84464] font-medium hover:underline"
                    >
                      Clear
                    </span>
                  )}
                  {isFormatOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>

              {isFormatOpen && (
                <div className="px-4 pb-4 pt-1 flex flex-wrap gap-1.5 border-t border-slate-100">
                  {formatsList.map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setSelectedFormat(selectedFormat === fmt ? '' : fmt)}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition ${
                        selectedFormat === fmt
                          ? 'border-[#f84464] bg-[#f84464] text-white shadow-sm'
                          : 'border-slate-200 text-[#f84464] hover:bg-rose-50/60'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom CTA: Full-width outlined red button (Browse by Cinemas) */}
            <button
              type="button"
              onClick={() => alert('Cinemas in Medchal & Hyderabad: PVR Forum Sujana Mall, Prasads Multiplex, Sree Ramulu Medchal, INOX GVK One Banjara Hills.')}
              className="w-full py-2.5 text-center text-[#f84464] border border-[#f84464] hover:bg-[#f84464] hover:text-white rounded-lg text-xs font-bold transition shadow-sm"
            >
              Browse by Cinemas
            </button>
          </aside>

          {/* ================= RIGHT MAIN FEED: MOVIE LISTINGS (~75% width) ================= */}
          <main className="flex-1 w-full space-y-5">
            {/* Section Heading & Quick Filters */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Movies In {selectedCity || 'Medchal'}
                </h1>
                <span className="text-xs text-slate-500 font-medium">
                  {filteredMovies.length} Verified Resale Titles
                </span>
              </div>

              {/* Quick Language Filter Pills (Horizontal wrap matching BookMyShow) */}
              <div className="flex flex-wrap gap-2 pt-1">
                {languagesList.slice(0, 8).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setSelectedLanguage(selectedLanguage === lang ? '' : lang)}
                    className={`px-3.5 py-1 rounded-full text-xs font-medium transition border ${
                      selectedLanguage === lang
                        ? 'bg-[#f84464] text-white border-[#f84464] shadow-sm'
                        : 'bg-white text-[#f84464] border-slate-200 hover:border-[#f84464]'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* "Coming Soon" Banner Card (Full-width white card from spec) */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 bg-[#f84464] rounded-full animate-ping"></div>
                <span className="font-extrabold text-sm text-slate-900">Coming Soon</span>
                <span className="text-xs text-slate-400 hidden sm:inline">| Explore upcoming BookMyShow transfers</span>
              </div>
              <button
                type="button"
                onClick={() => alert('Upcoming BookMyShow Resale Releases: Avengers: Doomsday, The Hunger Games: Sunrise on the Reaping, Pratap.')}
                className="text-xs font-bold text-[#f84464] hover:underline flex items-center"
              >
                <span>Explore Upcoming Movies</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </button>
            </div>

            {/* Notification Alert if any */}
            {notificationMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs font-medium flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{notificationMsg}</span>
              </div>
            )}

            {/* Movie Poster Grid (4 Columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredMovies.map((movie) => {
                const discountPct = Math.round(((movie.originalPrice - movie.resalePrice) * 100) / movie.originalPrice);

                return (
                  <div
                    key={movie.id}
                    className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
                  >
                    {/* Vertical Poster Image with Dark Bottom Overlay Strip */}
                    <div className="relative aspect-[2/3] w-full bg-slate-900 overflow-hidden cursor-pointer" onClick={() => handleOpenBuy(movie)}>
                      {/* Gradient Poster Placeholder */}
                      <div className={`w-full h-full bg-gradient-to-t ${movie.posterColor} flex flex-col justify-between p-4 group-hover:scale-105 transition-transform duration-500`}>
                        {/* Top Badges: Promoted & Anti-Scalping Cap */}
                        <div className="flex justify-between items-start">
                          {movie.isPromoted ? (
                            <span className="bg-[#f84464] text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded shadow">
                              PROMOTED
                            </span>
                          ) : (
                            <span className="bg-black/50 backdrop-blur-sm text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                              VERIFIED RESALE
                            </span>
                          )}

                          <span className="bg-emerald-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded shadow">
                            {discountPct}% OFF
                          </span>
                        </div>

                        {/* Centered Poster Title Representation */}
                        <div className="text-center my-auto px-2">
                          <h3 className="text-xl font-black text-white tracking-tight drop-shadow-md">
                            {movie.title}
                          </h3>
                          <span className="text-[11px] text-slate-300 font-semibold">{movie.format}</span>
                        </div>
                      </div>

                      {/* Dark Bottom Overlay Strip (Star rating, likes, votes) */}
                      <div className="absolute bottom-0 inset-x-0 bg-black/85 backdrop-blur-xs text-white px-3 py-1.5 flex items-center justify-between text-[11px]">
                        <div className="flex items-center space-x-1 font-bold text-amber-400">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{movie.rating}</span>
                        </div>
                        <span className="text-slate-300 text-[10px] font-medium">{movie.votes}</span>
                      </div>
                    </div>

                    {/* Movie Information Below Poster */}
                    <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                      <div>
                        <h2 className="font-bold text-sm text-slate-900 group-hover:text-[#f84464] transition line-clamp-1">
                          {movie.title}
                        </h2>

                        <p className="text-[11px] text-slate-500 font-medium">
                          {movie.cbfc} • {movie.languages}
                        </p>

                        <div className="flex items-center space-x-1 text-[10px] text-slate-500 pt-1">
                          <MapPin className="w-3 h-3 text-[#f84464] flex-shrink-0" />
                          <span className="truncate">{movie.venue}</span>
                        </div>
                      </div>

                      {/* Pricing with 80% Anti-Scalping Protection */}
                      <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 line-through">
                            ₹{movie.originalPrice / 100}
                          </span>
                          <div className="text-base font-extrabold text-slate-900">
                            ₹{movie.resalePrice / 100}
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                          Save ₹{(movie.originalPrice - movie.resalePrice) / 100}
                        </span>
                      </div>

                      {/* Action Buttons: Red "Buy Ticket" & "Request" */}
                      <div className="pt-1 flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenBuy(movie)}
                          className="flex-1 py-2 px-2 bg-[#f84464] hover:bg-[#d63653] text-white rounded-md text-[11px] font-bold transition flex items-center justify-center space-x-1 shadow-sm"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Buy Ticket</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenRequest(movie)}
                          className="py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-semibold transition"
                          title="Send purchase request to seller"
                        >
                          Request
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </main>
        </div>
      </div>

      {/* 4. Below-the-Fold SEO Content & Footers */}
      <section className="bg-white border-t border-slate-200 mt-12 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 text-xs text-slate-600">
          {/* Breadcrumb Strip */}
          <div className="flex items-center space-x-2 text-slate-400 font-medium">
            <span className="hover:text-slate-800 cursor-pointer">Home</span>
            <span>→</span>
            <span className="hover:text-slate-800 cursor-pointer">Movies</span>
            <span>→</span>
            <span className="text-slate-800 font-bold">Medchal / Hyderabad Resale Passes</span>
          </div>

          {/* SEO Editorial & FAQ Block (17-item FAQ from spec) */}
          <div className="space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">
              Authorized Movie Ticket Resale & Transfer in Medchal
            </h3>
            <p className="leading-relaxed">
              BookMyShow Medchal now coordinates official, secure ticket resale through TrustPass. If you booked a ticket for a theatre located far away (e.g. 35 km away in Kompally or Banjara Hills), you can legally transfer your ticket under the <strong>80% Maximum Fair Pricing Cap</strong>. TrustPass verifies booking reference fingerprints to eliminate duplicate tickets and coordinates authorized transfer invitations directly through the ticket provider before seller settlement.
            </p>

            <h4 className="text-sm font-bold text-slate-900 pt-3">Frequently Asked Questions (FAQs)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <strong className="text-slate-900 font-bold">1. How does ticket transfer work?</strong>
                <p>When a buyer purchases a resale ticket, the seller enters the buyer's registered BookMyShow email to initiate an authorized transfer. Once accepted, the ticket is re-issued in the buyer's name.</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <strong className="text-slate-900 font-bold">2. What is the 80% maximum resale price limit?</strong>
                <p>To eliminate scalpers and illegal black-marketing, TrustPass strictly caps resale prices to a maximum of 80% of original face value. Sellers cannot inflate prices.</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <strong className="text-slate-900 font-bold">3. How are duplicate listings prevented?</strong>
                <p>Every booking reference is hashed into a secure HMAC-SHA256 fingerprint. Once a ticket is listed or transferred, duplicate attempts are immediately blocked.</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <strong className="text-slate-900 font-bold">4. How does the 35 km theatre warning protect buyers?</strong>
                <p>TrustPass checks your destination cinema distance and displays an interactive warning modal before payment so you never travel to the wrong cinema.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dark Multi-Column Footer */}
      <footer className="bg-[#333545] text-slate-400 text-xs">
        {/* Partner CTA Strip */}
        <div className="bg-[#404358] py-4 border-b border-slate-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-2 text-white">
              <Ticket className="w-5 h-5 text-[#f84464]" />
              <span className="font-bold">Have an unused movie ticket you cannot attend?</span>
              <span className="text-slate-300 hidden sm:inline">List your ticket under the 80% fair price rule.</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToBuyer()}
              className="bg-[#f84464] hover:bg-[#d63653] text-white px-4 py-2 rounded-md font-bold transition shadow-sm"
            >
              Contact Today!
            </button>
          </div>
        </div>

        {/* Support Strip */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center border-b border-slate-600/60">
          <div className="space-y-1">
            <ShieldCheck className="w-6 h-6 text-emerald-400 mx-auto" />
            <h5 className="font-bold text-white text-[11px] uppercase tracking-wider">24/7 CUSTOMER CARE</h5>
            <p className="text-[10px] text-slate-400">Guaranteed buyer protection and authorized transfer dispute resolution.</p>
          </div>
          <div className="space-y-1">
            <CheckCircle2 className="w-6 h-6 text-[#f84464] mx-auto" />
            <h5 className="font-bold text-white text-[11px] uppercase tracking-wider">RESEND BOOKING CONFIRMATION</h5>
            <p className="text-[10px] text-slate-400">Instant digital cinema pass with official gate QR code.</p>
          </div>
          <div className="space-y-1">
            <Sparkles className="w-6 h-6 text-amber-400 mx-auto" />
            <h5 className="font-bold text-white text-[11px] uppercase tracking-wider">SUBSCRIBE TO THE NEWSLETTER</h5>
            <p className="text-[10px] text-slate-400">Get notified when sold-out movie tickets are transferred nearby.</p>
          </div>
        </div>

        {/* Bottom Brand Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center space-y-4">
          <div className="flex items-center justify-center space-x-2">
            <span className="text-xl font-black text-white">book<span className="text-[#f84464]">my</span>show</span>
            <span className="text-[10px] font-bold bg-[#f84464] text-white px-1.5 py-0.5 rounded">TrustPass</span>
          </div>
          <p className="text-[11px] text-slate-500 max-w-xl mx-auto">
            Copyright 2026 © Bigtree Entertainment Pvt. Ltd. All Rights Reserved. TrustPass Authorized Resale Protocol.
          </p>
        </div>
      </footer>

      {/* Buy Ticket Modal with Live QR Pass */}
      {selectedListingForBuy && (
        <BuyTicketModal
          listing={selectedListingForBuy}
          isOpen={Boolean(selectedListingForBuy)}
          onClose={() => setSelectedListingForBuy(null)}
          session={session}
          onSuccess={() => {
            setNotificationMsg('Ticket purchased successfully! Official BookMyShow transfer invitation generated.');
          }}
        />
      )}
    </div>
  );
};
