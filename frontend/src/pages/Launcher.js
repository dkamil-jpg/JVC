import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, UserCheck, BarChart3, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const LauncherCard = ({ icon: Icon, title, subtitle, onClick, glowClass, hoverBorder, testId }) => (
  <div
    data-testid={testId}
    onClick={onClick}
    className={`group relative overflow-hidden rounded-3xl bg-slate-900/80 border border-slate-800 p-10 w-full md:w-80 cursor-pointer transition-all duration-300 hover:${glowClass} hover:${hoverBorder} transform hover:-translate-y-2`}
  >
    <div className="absolute inset-0 bg-gradient-to-b from-slate-800/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
    <div className="relative z-10 flex flex-col items-center h-full justify-center">
      <div className="p-5 rounded-2xl bg-slate-950 mb-6 transition-colors shadow-inner">
        <Icon className="w-16 h-16 text-slate-500 group-hover:text-current transition-colors" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
      <p className="text-slate-500 text-sm font-medium">{subtitle}</p>
    </div>
  </div>
);

const Launcher = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();

  // If user is logged in, clicking Staff/Reports goes directly (no login needed)
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

  return (
    <div 
      data-testid="launcher-view" 
      className="min-h-screen flex flex-col bg-slate-950"
      style={{
        backgroundImage: 'linear-gradient(to bottom, rgba(2,6,23,0.95), rgba(2,6,23,0.98)), url(https://images.unsplash.com/photo-1584884013345-88b9cf247c0c?w=1920&q=80)',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-6xl w-full text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 tracking-tight">
            Just Vitality{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">
              Clinic
            </span>
          </h1>
          <p className="text-slate-400 mb-16 text-xl tracking-wide">
            Advanced Clinical Management
          </p>

          <div className="flex flex-col md:flex-row gap-8 justify-center items-stretch px-4">
            {/* Staff Portal */}
            <div
              data-testid="launcher-staff-btn"
              onClick={handleStaffClick}
              className="group relative overflow-hidden rounded-3xl bg-slate-900/80 border border-slate-800 p-10 w-full md:w-80 cursor-pointer transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:border-blue-500 transform hover:-translate-y-2"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10 flex flex-col items-center h-full justify-center">
                <div className="p-5 rounded-2xl bg-slate-950 mb-6 transition-colors shadow-inner">
                  <Stethoscope className="w-16 h-16 text-slate-500 group-hover:text-blue-500 transition-colors" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Staff Portal</h2>
                <p className="text-slate-500 text-sm font-medium">Administration & Records</p>
              </div>
            </div>

            {/* Analytics */}
            <div
              data-testid="launcher-reports-btn"
              onClick={handleReportsClick}
              className="group relative overflow-hidden rounded-3xl bg-slate-900/80 border border-slate-800 p-10 w-full md:w-80 cursor-pointer transition-all duration-300 hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] hover:border-violet-500 transform hover:-translate-y-2"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-violet-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10 flex flex-col items-center h-full justify-center">
                <div className="p-5 rounded-2xl bg-slate-950 mb-6 transition-colors shadow-inner">
                  <BarChart3 className="w-16 h-16 text-slate-500 group-hover:text-violet-500 transition-colors" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Clinic Analytics</h2>
                <p className="text-slate-500 text-sm font-medium">Business Intelligence</p>
              </div>
            </div>

            {/* Kiosk */}
            <div
              data-testid="launcher-kiosk-btn"
              onClick={() => navigate('/kiosk')}
              className="group relative overflow-hidden rounded-3xl bg-slate-900/80 border border-slate-800 p-10 w-full md:w-80 cursor-pointer transition-all duration-300 hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:border-emerald-500 transform hover:-translate-y-2"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10 flex flex-col items-center h-full justify-center">
                <div className="p-5 rounded-2xl bg-slate-950 mb-6 transition-colors shadow-inner">
                  <UserCheck className="w-16 h-16 text-slate-500 group-hover:text-emerald-500 transition-colors" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Patient Check-In</h2>
                <p className="text-slate-500 text-sm font-medium">Self-Service Registration</p>
              </div>
            </div>
          </div>

          {/* Kiosk Mode Link - for tablet setup */}
          <div className="mt-8">
            <button
              onClick={() => navigate('/kiosk?mode=locked')}
              className="text-xs text-slate-600 hover:text-emerald-500 transition-colors flex items-center gap-1 mx-auto"
            >
              <Lock className="w-3 h-3" />
              Launch Tablet Kiosk Mode (PIN: 1234)
            </button>
          </div>
        </div>
      </div>

      <footer className="p-4 text-center text-xs text-slate-600">
        System by{' '}
        <a href="mailto:dyczkowski.kamil@gmail.com" className="text-blue-500 hover:underline">
          Kamil Dyczkowski
        </a>{' '}
        2026
      </footer>
    </div>
  );
};

export default Launcher;
