import React, { useState } from 'react';
import { X, Lock, UserCheck, ShieldCheck, Database, KeyRound, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { UserProfile } from '../types';
import { loginApi } from '../utils/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onLoginSuccess: (user: UserProfile, token: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleLogin = async (u: string, p: string) => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const result = await loginApi(u, p);
      if (result.success && result.user && result.token) {
        onLoginSuccess(result.user, result.token);
        onClose();
      } else {
        setErrorMessage(result.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Please enter both username and password.');
      return;
    }
    handleLogin(username.trim(), password);
  };

  const handleQuickLogin = (uname: string, pword: string) => {
    setUsername(uname);
    setPassword(pword);
    handleLogin(uname, pword);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div 
        className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                {currentUser ? 'Switch User Account' : 'Sign in to RemitPal'}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                PostgreSQL Authentication with secure scrypt hashing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Quick Preset Selector */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Quick Select Account
              </span>
              <span className="text-[11px] text-neutral-400 font-mono">
                Click to log in instantly
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Card 1: Siti Rahayu */}
              <button
                type="button"
                onClick={() => handleQuickLogin('siti', 'siti123')}
                disabled={isLoading}
                className={`p-3.5 rounded-xl border text-left transition-all relative group flex flex-col justify-between ${
                  currentUser?.username === 'siti'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-emerald-400 dark:hover:border-emerald-600 bg-neutral-50/50 dark:bg-neutral-800/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                      Remitter · HK
                    </span>
                    {currentUser?.username === 'siti' && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <UserCheck className="w-3.5 h-3.5" />
                        Active
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mt-2">
                    Siti Rahayu
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Causeway Bay, Hong Kong
                  </p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-2">
                    Sends 15M IDR/mo & verifies receipts
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-neutral-200/60 dark:border-neutral-700/60 flex items-center justify-between text-[11px]">
                  <span className="font-mono text-neutral-400">siti / siti123</span>
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>

              {/* Card 2: Slamet Widodo */}
              <button
                type="button"
                onClick={() => handleQuickLogin('slamet', 'slamet123')}
                disabled={isLoading}
                className={`p-3.5 rounded-xl border text-left transition-all relative group flex flex-col justify-between ${
                  currentUser?.username === 'slamet'
                    ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 ring-2 ring-sky-500/20'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-sky-400 dark:hover:border-sky-600 bg-neutral-50/50 dark:bg-neutral-800/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-300">
                      Manager · Indramayu
                    </span>
                    {currentUser?.username === 'slamet' && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-400">
                        <UserCheck className="w-3.5 h-3.5" />
                        Active
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mt-2">
                    Slamet Widodo
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Karangampel, Indramayu
                  </p>
                  <p className="text-[11px] text-sky-600 dark:text-sky-400 mt-2">
                    Manages renovation & uploads proofs
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-neutral-200/60 dark:border-neutral-700/60 flex items-center justify-between text-[11px]">
                  <span className="font-mono text-neutral-400">slamet / slamet123</span>
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-200 dark:border-neutral-800" />
            </div>
            <span className="relative px-3 bg-white dark:bg-neutral-900 text-xs text-neutral-400 uppercase tracking-wider">
              Or sign in with credentials
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                {errorMessage}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="siti or slamet"
                className="w-full px-3.5 py-2 text-sm rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-neutral-900 dark:text-neutral-100"
                autoCapitalize="none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Password
                </label>
                <span className="text-[11px] text-neutral-400">
                  Default: username + 123
                </span>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 text-sm rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-neutral-900 dark:text-neutral-100 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Auth Info */}
          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 flex items-start gap-2.5 text-xs text-neutral-600 dark:text-neutral-400">
            <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                PostgreSQL Authentication
              </span>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Passwords are encrypted with cryptographic scrypt hashing. Sessions are persisted server-side and cached locally for offline reliability.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
