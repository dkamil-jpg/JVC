import React from "react";
import "@/App.css";
import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ClinicProvider } from "./contexts/ClinicContext";
import { Toaster } from "@/components/ui/toaster";

// Pages
import Launcher from "./pages/Launcher";
import Login from "./pages/Login";
import Kiosk from "./pages/Kiosk";
import StaffPortal from "./pages/StaffPortal";
import Analytics from "./pages/Analytics";

// Inactivity Warning Modal
const InactivityWarning = () => {
  const { showInactivityWarning, warningCountdown, stayLoggedIn } = useAuth();
  
  if (!showInactivityWarning) return null;
  
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border-2 border-yellow-500 rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl animate-pulse-slow">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
          <svg className="w-10 h-10 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2">Session Expiring</h2>
        <p className="text-slate-400 mb-6">You will be logged out due to inactivity</p>
        
        <div className="w-24 h-24 mx-auto mb-6 rounded-full border-4 border-yellow-500 flex items-center justify-center">
          <span className="text-4xl font-bold text-yellow-500 tabular-nums">{warningCountdown}</span>
        </div>
        
        <button 
          onClick={stayLoggedIn}
          className="w-full py-3 px-6 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl transition-colors text-lg"
        >
          Stay Logged In
        </button>
        
        <p className="text-xs text-slate-500 mt-4">Move mouse or press any key to stay active</p>
      </div>
    </div>
  );
};

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// App content with routing
const AppContent = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Launcher />} />
        <Route path="/login" element={<Login />} />
        <Route path="/kiosk" element={<Kiosk />} />
        
        {/* Protected routes */}
        <Route 
          path="/staff" 
          element={
            <ProtectedRoute>
              <ClinicProvider>
                <StaffPortal />
              </ClinicProvider>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/analytics" 
          element={
            <ProtectedRoute>
              <Analytics />
            </ProtectedRoute>
          } 
        />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
      <InactivityWarning />
    </BrowserRouter>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
