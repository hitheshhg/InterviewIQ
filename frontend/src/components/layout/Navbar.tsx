import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles, Menu, X, LogOut, User as UserIcon, LayoutDashboard, FileText, Mic, Map } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';

interface NavbarProps {
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAuth }) => {
  const { currentUser, userProfile, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { name: 'Overview', path: '/' },
    { name: 'ATS Scanner', path: '/analyzer', icon: <FileText className="w-3.5 h-3.5" /> },
    { name: 'Mock Interview', path: '/interview', icon: <Mic className="w-3.5 h-3.5" /> },
    { name: 'Career Roadmap', path: '/roadmap', icon: <Map className="w-3.5 h-3.5" /> },
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="sticky top-4 z-40 w-full max-w-6xl mx-auto px-4 sm:px-6 mb-8">
      <nav className="flex items-center justify-between py-3.5 px-5 sm:px-6 rounded-2xl glass-card border border-white/10 shadow-glass bg-[#0B0F19]/80 backdrop-blur-xl">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 flex items-center justify-center shadow-neon-cyan group-hover:scale-105 transition-transform">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight aurora-gradient-text">InterviewIQ</span>
              <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                AI Engine
              </span>
            </div>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden lg:flex items-center gap-1 bg-white/[0.02] p-1 rounded-xl border border-white/5">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-white/10 text-white shadow-sm border border-white/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {link.icon}
                {link.name}
              </Link>
            );
          })}
        </div>

        {/* Right CTA / Auth Status */}
        <div className="hidden sm:flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    className="w-6 h-6 rounded-full border border-cyan-400/40 object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                    {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <span className="font-medium text-slate-200 max-w-[120px] truncate">
                  {userProfile?.display_name || currentUser.displayName || currentUser.email}
                </span>
              </div>

              <button
                onClick={logout}
                className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 transition"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Button
              variant="primary"
              size="sm"
              icon={<UserIcon className="w-3.5 h-3.5" />}
              onClick={onOpenAuth}
            >
              Sign In
            </Button>
          )}
        </div>

        {/* Mobile Hamburger */}
        <div className="flex sm:hidden items-center gap-2">
          {currentUser && (
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
              {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
            </div>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-300"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="sm:hidden mt-2 p-4 rounded-2xl glass-card border border-white/10 bg-[#0B0F19]/95 backdrop-blur-2xl shadow-glass flex flex-col gap-2">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5"
            >
              {link.icon}
              {link.name}
            </Link>
          ))}
          <div className="pt-2 border-t border-white/10 flex justify-between items-center">
            {currentUser ? (
              <Button
                variant="danger"
                size="sm"
                icon={<LogOut className="w-3.5 h-3.5" />}
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="w-full"
              >
                Sign Out
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                icon={<UserIcon className="w-3.5 h-3.5" />}
                onClick={() => {
                  onOpenAuth();
                  setMobileMenuOpen(false);
                }}
                className="w-full"
              >
                Sign In / Register
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
