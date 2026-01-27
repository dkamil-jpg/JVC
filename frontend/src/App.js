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
