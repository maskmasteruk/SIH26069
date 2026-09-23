import React, { useState } from 'react';
import { useEvents } from '../../context/EventContext';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';

export const AdminLoginPage: React.FC = () => {
  const { adminLogin, navigate } = useEvents();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const success = await adminLogin(username, password);
      setIsLoading(false);
      if (!success) {
        setErrorMessage('Invalid credentials or authentication service unavailable.');
      }
    } catch {
      setIsLoading(false);
      setErrorMessage('Authentication service unavailable. Confirm PostgreSQL is running.');
    }
  };

  const handleQuickFill = () => {
    setUsername('admin');
    setPassword('admin');
    setErrorMessage('');
  };

  return (
    <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm bg-white rounded-lg border border-slate-200 p-8 space-y-6">
        {/* Header */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-tight text-slate-900">
              WAVE Operations
            </span>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Public View</span>
            </button>
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Officer Sign In</h1>
          <p className="text-xs text-slate-500">
            Authenticate to access incident triage and master records.
          </p>
        </div>

        {/* Local Docker seed account */}
        <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded p-2.5 flex items-center justify-between">
          <span>
            Docker seed: <strong className="font-mono text-slate-800">admin / admin</strong>
          </span>
          <button
            type="button"
            onClick={handleQuickFill}
            className="text-[11px] text-slate-700 hover:underline font-medium cursor-pointer"
          >
            Auto-fill
          </button>
        </div>

        {/* Error notice */}
        {errorMessage && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2.5">
            {errorMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="text-slate-600 block">Username</label>
            <input
              type="text"
              required
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded border border-slate-300 focus:outline-hidden focus:border-slate-500 bg-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-600 block">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-3 py-2 text-xs rounded border border-slate-300 focus:outline-hidden focus:border-slate-500 bg-white pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-3 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded transition-colors cursor-pointer mt-2"
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="pt-2 text-center text-[11px] text-slate-400">
          Emergency Operations Desk - Restricted Console
        </div>
      </div>
    </div>
  );
};
