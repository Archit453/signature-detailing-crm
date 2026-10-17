import React, { useState } from 'react';
import { Lock, KeyRound, Eye, EyeOff, AlertCircle, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { useTheme } from '../context/ThemeContext';

interface LoginModalProps {
  onSuccess: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onSuccess }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = passcode.trim();
    if (!clean) {
      setErrorMsg('Please enter your studio passcode');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await api.verifyAuth(clean);
      if (res && res.success) {
        localStorage.setItem('signature_crm_auth', 'true');
        onSuccess();
      } else {
        setErrorMsg(res?.message || 'Incorrect studio passcode. Please try again.');
      }
    } catch {
      // Fallback for offline mode
      if (clean === 'signature2025' || clean === '1234') {
        localStorage.setItem('signature_crm_auth', 'true');
        onSuccess();
      } else {
        setErrorMsg('Incorrect studio passcode. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl bg-black/75 animate-fadeIn select-none">
      <div
        className={`w-full max-w-md rounded-3xl border shadow-2xl p-6 sm:p-8 transition-all ${
          isLight
            ? 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-900/10'
            : 'bg-[#1C1D21]/95 border-white/[0.1] text-white shadow-black/60'
        }`}
      >
        {/* Studio Branding */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center overflow-hidden shadow-[0_0_24px_rgba(94,129,244,0.35)] border border-amber-500/30 bg-black/60 mb-4">
            <img src="/logo.png" alt="Signature Detailing" className="w-full h-full object-contain p-1 drop-shadow-md" />
          </div>

          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-2 bg-[#5E81F4]/10 text-[#5E81F4] border border-[#5E81F4]/25">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Studio Management Terminal</span>
          </div>

          <h1 className="text-2xl font-black tracking-tight">
            Signature <span className="text-[#5E81F4]">Detailing</span>
          </h1>
          <p className={`text-xs mt-1.5 max-w-xs ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
            Restricted to authorized studio personnel. Please enter your passcode to access live leads and vehicle dossiers.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className={`block text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
              Studio Passcode
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>

              <input
                type={showPasscode ? 'text' : 'password'}
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Enter passcode (e.g. signature2025)"
                autoFocus
                className={`w-full pl-10 pr-11 py-3 rounded-2xl border text-sm font-medium transition-all outline-none ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-[#5E81F4] focus:ring-2 focus:ring-[#5E81F4]/20'
                    : 'bg-[#15161A] border-white/[0.08] text-white focus:border-[#5E81F4] focus:ring-2 focus:ring-[#5E81F4]/25'
                }`}
              />

              <button
                type="button"
                onClick={() => setShowPasscode(!showPasscode)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                tabIndex={-1}
              >
                {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center space-x-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-2xl bg-[#5E81F4] hover:bg-[#4E72EA] text-white font-bold text-sm transition-all shadow-[0_4px_16px_rgba(94,129,244,0.35)] active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Lock className="w-4 h-4 stroke-[2.5]" />
            <span>{isLoading ? 'Verifying...' : 'Unlock Studio CRM'}</span>
          </button>
        </form>

        <div className={`mt-6 text-center text-xs ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>
          <span>Default Studio Passcode: </span>
          <code className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 text-xs font-mono font-bold text-[#5E81F4]">
            signature2025
          </code>
        </div>
      </div>
    </div>
  );
};

