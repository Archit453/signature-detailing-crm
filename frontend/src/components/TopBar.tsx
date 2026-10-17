import React, { useState } from 'react';
import { Plus, Sun, Moon, RotateCw, Lock } from 'lucide-react';
import type { TabType } from './BottomNav';
import { useTheme } from '../context/ThemeContext';

interface TopBarProps {
  activeTab?: TabType;
  setActiveTab?: (tab: TabType) => void;
  unreadCount?: number;
  onOpenQuickLeadModal: () => void;
  onRefresh?: () => void;
  onLock?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenQuickLeadModal,
  onRefresh,
  onLock,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [isSpinning, setIsSpinning] = useState(false);

  const handleRefreshClick = () => {
    setIsSpinning(true);
    if (onRefresh) onRefresh();
    setTimeout(() => setIsSpinning(false), 800);
  };

  return (
    <header
      className={`sticky top-0 z-30 backdrop-blur-md border-b px-4 md:px-8 py-3 pt-safe font-sans transition-colors duration-200 ${
        theme === 'light'
          ? 'bg-white/95 border-slate-200/80 shadow-xs'
          : 'bg-[#16171A]/95 border-[#26272E]'
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Studio Branding */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden shadow-[0_0_12px_rgba(245,158,11,0.25)] border border-amber-500/20 bg-black/40">
            <img src="/logo.png" alt="Signature Detailing" className="w-full h-full object-contain p-0.5 drop-shadow-md" />
          </div>
          <div>
            <h1
              className={`text-base font-bold tracking-tight ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}
            >
              Signature <span className="text-[#5E81F4]">Detailing</span>
            </h1>
            <div className="flex items-center space-x-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span
                className={`text-xs font-medium ${
                  theme === 'light' ? 'text-slate-500' : 'text-zinc-400'
                }`}
              >
                Studio Online
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {/* Quick Refresh */}
          <button
            onClick={handleRefreshClick}
            className={`p-2 rounded-xl border transition-all active:scale-95 ${
              theme === 'light'
                ? 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
                : 'bg-[#1C1D21] border-[#26272E] text-zinc-300 hover:text-white'
            }`}
            title="Refresh Live Data"
          >
            <RotateCw className={`w-4 h-4 ${isSpinning ? 'animate-spin text-[#5E81F4]' : ''}`} />
          </button>

          {/* Day/Night Quick Toggle on Mobile */}
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-xl border transition-all active:scale-95 ${
              theme === 'light'
                ? 'bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900'
                : 'bg-[#1C1D21] border-[#26272E] text-zinc-300 hover:text-white'
            }`}
            title={theme === 'light' ? 'Switch to Night Theme' : 'Switch to Day Theme'}
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {/* Lock Terminal on Mobile */}
          {onLock && (
            <button
              onClick={onLock}
              className={`p-2 rounded-xl border transition-all active:scale-95 ${
                theme === 'light'
                  ? 'bg-slate-100 hover:bg-rose-50 border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-200'
                  : 'bg-[#1C1D21] hover:bg-rose-500/10 border-[#26272E] text-zinc-300 hover:text-rose-400 hover:border-rose-500/30'
              }`}
              title="Lock Studio CRM Session"
            >
              <Lock className="w-4 h-4" />
            </button>
          )}

          {/* Add Button */}
          <button
            onClick={onOpenQuickLeadModal}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#5E81F4] hover:bg-[#4E72EA] text-white text-xs sm:text-sm font-semibold transition-all active:scale-95 shadow-[0_4px_14px_rgba(94,129,244,0.35)]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add</span>
          </button>
        </div>
      </div>
    </header>
  );
};
