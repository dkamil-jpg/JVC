import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'staff';
  
  const { login } = useAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(username, password);
      if (result.success) {
        if (mode === 'reports') {
          navigate('/analytics');
        } else {
          navigate('/staff');
        }
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const title = mode === 'reports' ? 'Analytics Access' : 'Staff Access';
  const accentColor = mode === 'reports' ? 'violet' : 'blue';

  return (
    <div 
      data-testid="login-view"
      className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-950"
      style={{
        backgroundImage: 'linear-gradient(to bottom right, rgba(2,6,23,0.97), rgba(2,6,23,0.95)), url(https://images.unsplash.com/photo-1645477704075-cb3d14b349ee?w=1920&q=80)',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      <div className="glass-panel p-8 w-full max-w-sm relative rounded-2xl">
        <button 
          data-testid="login-back-btn"
          onClick={() => navigate('/')}
          className="absolute top-4 left-4 text-slate-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <h2 
          className={`text-2xl font-bold mb-8 text-center text-white`}
        >
          {title}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-slate-400">Username</Label>
            <Input
              data-testid="login-username-input"
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="bg-slate-950 border-slate-800 focus:border-blue-500 h-12"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-400">Password</Label>
            <Input
              data-testid="login-password-input"
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="bg-slate-950 border-slate-800 focus:border-blue-500 h-12"
            />
          </div>

          {error && (
            <div data-testid="login-error" className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            data-testid="login-submit-btn"
            type="submit"
            disabled={loading || !username || !password}
            className={`w-full h-12 text-lg font-semibold ${
              mode === 'reports' 
                ? 'bg-violet-600 hover:bg-violet-700' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Logging in...
              </>
            ) : (
              'Login'
            )}
          </Button>
        </form>
      </div>

      <footer className="mt-8 text-center text-xs text-slate-600">
        System by{' '}
        <a href="mailto:dyczkowski.kamil@gmail.com" className="text-blue-500 hover:underline">
          Kamil Dyczkowski
        </a>{' '}
        2026
      </footer>
    </div>
  );
};

export default Login;
