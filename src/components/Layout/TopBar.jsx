import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, ChevronDown, Settings, LogOut, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { signOut } from '../../lib/supabase';
import toast from 'react-hot-toast';

const ROLE_LABELS = { admin: 'Admin', dm: 'Delivery Manager', leadership: 'Leadership' };

export default function TopBar({ onMenuClick }) {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  async function handleLogout() {
    await signOut();
    navigate('/login');
    toast.success('Signed out');
  }

  return (
    <header className="bg-white border-b border-gray-200 h-14 flex items-center px-4 gap-3 z-30 flex-shrink-0">
      <button
        onClick={onMenuClick}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Logo */}
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => navigate('/')}
      >
        <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">L</span>
        </div>
        <span className="font-bold text-gray-900 text-base">DeliveryHub</span>
      </div>

      <div className="flex-1" />

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(o => !o)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition"
        >
          <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-blue-700 font-semibold text-xs">
              {profile?.full_name?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-sm font-medium text-gray-800 leading-tight">
              {profile?.full_name || 'User'}
            </div>
            <div className="text-xs text-gray-500">{ROLE_LABELS[profile?.role] || profile?.role}</div>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
            <div className="absolute right-0 top-10 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">{profile?.full_name}</p>
                <p className="text-xs text-gray-500">{profile?.email}</p>
                <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  {ROLE_LABELS[profile?.role]}
                </span>
              </div>

              {isAdmin() && (
                <button
                  onClick={() => { navigate('/admin'); setDropdownOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Settings className="w-4 h-4" />
                  Admin Panel
                </button>
              )}

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
