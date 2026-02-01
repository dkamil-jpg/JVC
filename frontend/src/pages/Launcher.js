import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, UserCheck, BarChart3, Lock, LogOut, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const Launcher = () => {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const { isDark } = useTheme();

  const handleStaffClick = () => {
    if (token && user) {
      navigate('/staff');
    } else {
      navigate('/login?mode=staff');
    }
  };

  const handleReportsClick = () => {
    if (token && user) {
      navigate('/analytics');
    } else {
      navigate('/login?mode=reports');
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div 
      data-testid="launcher-view" 
      className={`min-h-screen flex flex-col ${isDark ? 'bg-slate-950' : 'bg-gray-100'}`}
      style={isDark ? {
        backgroundImage: 'linear-gradient(to bottom, rgba(2,6,23,0.95), rgba(2,6,23,0.98)), url(https://images.unsplash.com/photo-1584884013345-88b9cf247c0c?w=1920&q=80)',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      } : {
        backgroundImage: 'linear-gradient(to bottom, rgba(249,250,251,0.95), rgba(243,244,246,0.98)), url(https://images.unsplash.com/photo-1584884013345-88b9cf247c0c?w=1920&q=80)',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* User Header - shown when logged in */}
      {user && token && (
        <div className={`absolute top-0 right-0 p-4 flex items-center gap-3 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span className="text-sm font-medium">{user.username}</span>
          </div>
          <button
            onClick={handleLogout}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              isDark 
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                : 'bg-red-100 text-red-600 hover:bg-red-200'
            }`}
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-6xl w-full text-center">
          <h1 className={`text-5xl md:text-7xl font-bold mb-4 tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Just Vitality{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">
              Clinic
            </span>
          </h1>
          <p className={`mb-16 text-xl tracking-wide ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
            Advanced Clinical Management
          </p>

          <div className="flex flex-col md:flex-row gap-8 justify-center items-stretch px-4">
            {/* Staff Portal */}
            <div
              data-testid="launcher-staff-btn"
              onClick={handleStaffClick}
              className={`group relative overflow-hidden rounded-3xl border p-10 w-full md:w-80 cursor-pointer transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:border-blue-500 transform hover:-translate-y-2 ${
                isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-gray-200'
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10 flex flex-col items-center h-full justify-center">
                <div className={`p-5 rounded-2xl mb-6 transition-colors shadow-inner ${isDark ? 'bg-slate-950' : 'bg-gray-100'}`}>
                  <Stethoscope className={`w-16 h-16 group-hover:text-blue-500 transition-colors ${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
                </div>
                <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Staff Portal</h2>
                <p className={`text-sm font-medium ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>Administration & Records</p>
              </div>
            </div>

            {/* Analytics */}
            <div
              data-testid="launcher-reports-btn"
              onClick={handleReportsClick}
              className={`group relative overflow-hidden rounded-3xl border p-10 w-full md:w-80 cursor-pointer transition-all duration-300 hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] hover:border-violet-500 transform hover:-translate-y-2 ${
                isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-gray-200'
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-violet-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10 flex flex-col items-center h-full justify-center">
                <div className={`p-5 rounded-2xl mb-6 transition-colors shadow-inner ${isDark ? 'bg-slate-950' : 'bg-gray-100'}`}>
                  <BarChart3 className={`w-16 h-16 group-hover:text-violet-500 transition-colors ${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
                </div>
                <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Clinic Analytics</h2>
                <p className={`text-sm font-medium ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>Business Intelligence</p>
              </div>
            </div>

            {/* Kiosk */}
            <div
              data-testid="launcher-kiosk-btn"
              onClick={() => navigate('/kiosk')}
              className={`group relative overflow-hidden rounded-3xl border p-10 w-full md:w-80 cursor-pointer transition-all duration-300 hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:border-emerald-500 transform hover:-translate-y-2 ${
                isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-gray-200'
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10 flex flex-col items-center h-full justify-center">
                <div className={`p-5 rounded-2xl mb-6 transition-colors shadow-inner ${isDark ? 'bg-slate-950' : 'bg-gray-100'}`}>
                  <UserCheck className={`w-16 h-16 group-hover:text-emerald-500 transition-colors ${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
                </div>
                <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Patient Check-In</h2>
                <p className={`text-sm font-medium ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>Self-Service Registration</p>
              </div>
            </div>
          </div>

          {/* Kiosk Mode Link */}
          <div className="mt-8">
            <button
              onClick={() => navigate('/kiosk?mode=locked')}
              className={`text-xs transition-colors flex items-center gap-1 mx-auto ${
                isDark ? 'text-slate-600 hover:text-emerald-500' : 'text-gray-500 hover:text-emerald-600'
              }`}
            >
              <Lock className="w-3 h-3" />
              Launch Tablet Kiosk Mode
            </button>
          </div>
        </div>
      </div>

      <footer className={`p-4 text-center text-xs ${isDark ? 'text-slate-600' : 'text-gray-500'}`}>
        System by{' '}
        <a href="https://kamildyczkowski.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
          Kamil Dyczkowski
        </a>{' '}
        2026
      </footer>
    </div>
  );
};

export default Launcher;
