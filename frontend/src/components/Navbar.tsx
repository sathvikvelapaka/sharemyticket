import React, { useState } from 'react';
import { 
  Search, MapPin, ChevronDown, Bell, Menu, ShieldCheck, 
  Ticket, LayoutDashboard, Store, ShieldAlert, Sparkles, X 
} from 'lucide-react';
import { UserSession } from '../types';

interface NavbarProps {
  currentTab: 'marketplace' | 'buyer' | 'seller' | 'admin';
  setCurrentTab: (tab: 'marketplace' | 'buyer' | 'seller' | 'admin') => void;
  session: UserSession;
  onSwitchRole: (role: 'buyer' | 'seller' | 'admin') => void;
  notificationsCount: number;
  onOpenNotifications: () => void;
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  session,
  onSwitchRole,
  notificationsCount,
  onOpenNotifications,
  selectedCity,
  setSelectedCity,
  searchQuery,
  setSearchQuery,
}) => {
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const cities = ['Medchal', 'Hyderabad', 'Kompally', 'Bangalore', 'Mumbai', 'Delhi'];

  return (
    <header className="sticky top-0 z-40 bg-[#333545] text-white shadow-md">
      {/* 1. Top Utility Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Left: Brand Logo & Wide Search Input */}
          <div className="flex items-center flex-1 space-x-6">
            <div 
              onClick={() => setCurrentTab('marketplace')} 
              className="flex items-center space-x-1.5 cursor-pointer flex-shrink-0"
            >
              {/* Authentic BookMyShow-style red brand logo */}
              <div className="flex items-center space-x-1">
                <span className="text-xl sm:text-2xl font-black tracking-tighter text-white">
                  book<span className="text-[#f84464]">my</span>show
                </span>
                <span className="text-[10px] font-extrabold bg-[#f84464] text-white px-1.5 py-0.5 rounded uppercase tracking-wider ml-1 shadow-sm">
                  TrustPass
                </span>
              </div>
            </div>

            {/* Wide Search Input */}
            <div className="relative flex-1 max-w-2xl hidden md:block">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for Movies, Events, Plays, Sports and Activities"
                className="w-full pl-10 pr-4 py-2 bg-white text-slate-900 rounded-md text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#f84464]"
              />
            </div>
          </div>

          {/* Right: Location Selector, Sign In CTA, Persona Switcher & Menu */}
          <div className="flex items-center space-x-3 sm:space-x-4 flex-shrink-0">
            {/* Location Selector Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCityDropdown(!showCityDropdown)}
                className="flex items-center space-x-1 text-xs font-medium text-slate-200 hover:text-white transition py-1 px-2 rounded hover:bg-slate-700/50"
              >
                <span>{selectedCity || 'Medchal, Hyderabad'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showCityDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white text-slate-800 rounded-lg shadow-2xl py-2 z-50 border border-slate-200 text-xs">
                  <span className="px-3 py-1 font-bold text-slate-400 uppercase text-[10px] block">Popular Regions</span>
                  {cities.map((city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => {
                        setSelectedCity(city);
                        setShowCityDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-rose-50 hover:text-[#f84464] transition flex items-center justify-between"
                    >
                      <span>{city}</span>
                      {selectedCity === city && <span className="w-1.5 h-1.5 bg-[#f84464] rounded-full"></span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notifications */}
            <button
              type="button"
              onClick={onOpenNotifications}
              className="relative p-1.5 text-slate-300 hover:text-white transition"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {notificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#f84464] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {notificationsCount}
                </span>
              )}
            </button>

            {/* Persona Switcher / Role Pill */}
            <div className="hidden sm:flex items-center bg-[#222433] rounded-md p-0.5 text-[11px] border border-slate-700">
              <button
                type="button"
                onClick={() => onSwitchRole('buyer')}
                className={`px-2.5 py-1 rounded font-semibold transition ${
                  session.user.role === 'buyer' ? 'bg-[#f84464] text-white shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                Buyer
              </button>
              <button
                type="button"
                onClick={() => onSwitchRole('seller')}
                className={`px-2.5 py-1 rounded font-semibold transition ${
                  session.user.role === 'seller' ? 'bg-[#f84464] text-white shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                Seller
              </button>
              <button
                type="button"
                onClick={() => onSwitchRole('admin')}
                className={`px-2.5 py-1 rounded font-semibold transition ${
                  session.user.role === 'admin' ? 'bg-amber-500 text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                Admin
              </button>
            </div>

            {/* Red Sign In / Status CTA Button */}
            <button
              type="button"
              onClick={() => setCurrentTab(session.user.role === 'seller' ? 'seller' : session.user.role === 'admin' ? 'admin' : 'buyer')}
              className="bg-[#f84464] hover:bg-[#d63653] text-white px-3.5 py-1.5 rounded-md text-xs font-semibold shadow-sm transition"
            >
              {session.user.fullName.split(' ')[0]} ({session.user.role})
            </button>

            {/* Mobile Hamburger Menu Toggle */}
            <button
              type="button"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="text-slate-300 hover:text-white md:hidden"
            >
              {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Secondary Sub-Navigation Strip (BookMyShow standard dark strip) */}
      <div className="bg-[#222433] border-t border-slate-700/60 text-xs text-slate-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-10 overflow-x-auto whitespace-nowrap">
          {/* Left Category Links */}
          <div className="flex items-center space-x-6">
            <button
              type="button"
              onClick={() => setCurrentTab('marketplace')}
              className={`hover:text-white transition font-medium ${currentTab === 'marketplace' ? 'text-[#f84464] font-bold' : ''}`}
            >
              Movies
            </button>
            <span className="hover:text-white cursor-pointer transition">Stream</span>
            <span className="hover:text-white cursor-pointer transition">Events</span>
            <span className="hover:text-white cursor-pointer transition">Plays</span>
            <span className="hover:text-white cursor-pointer transition">Sports</span>
            <span className="hover:text-white cursor-pointer transition">Activities</span>
          </div>

          {/* Right Links & Dashboards */}
          <div className="flex items-center space-x-5 text-slate-300">
            <button
              type="button"
              onClick={() => setCurrentTab('seller')}
              className={`hover:text-white transition flex items-center space-x-1 ${currentTab === 'seller' ? 'text-[#f84464] font-bold' : ''}`}
            >
              <Store className="w-3.5 h-3.5 text-[#f84464]" />
              <span>ListYourShow (Resell Ticket)</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab('buyer')}
              className={`hover:text-white transition flex items-center space-x-1 ${currentTab === 'buyer' ? 'text-[#f84464] font-bold' : ''}`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Buyer Dashboard</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab('admin')}
              className={`hover:text-white transition flex items-center space-x-1 ${currentTab === 'admin' ? 'text-amber-400 font-bold' : ''}`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Governance & Fraud</span>
            </button>

            <span className="hover:text-white cursor-pointer transition hidden lg:inline">Corporates</span>
            <span className="hover:text-white cursor-pointer transition hidden lg:inline">Offers (80% Cap)</span>
            <span className="hover:text-white cursor-pointer transition hidden lg:inline">Gift Cards</span>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {showMobileMenu && (
        <div className="md:hidden bg-[#222433] px-4 py-3 border-t border-slate-700 space-y-2 text-xs">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for Movies, Events..."
            className="w-full px-3 py-2 bg-white text-slate-900 rounded mb-2 text-xs"
          />
          <div className="flex space-x-2 pt-1">
            <button
              type="button"
              onClick={() => { onSwitchRole('buyer'); setShowMobileMenu(false); }}
              className="flex-1 py-1.5 bg-slate-700 text-white rounded font-bold"
            >
              Buyer
            </button>
            <button
              type="button"
              onClick={() => { onSwitchRole('seller'); setShowMobileMenu(false); }}
              className="flex-1 py-1.5 bg-[#f84464] text-white rounded font-bold"
            >
              Seller
            </button>
            <button
              type="button"
              onClick={() => { onSwitchRole('admin'); setShowMobileMenu(false); }}
              className="flex-1 py-1.5 bg-amber-500 text-slate-900 rounded font-bold"
            >
              Admin
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
