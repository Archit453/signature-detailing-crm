import React from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  Sparkles,
  Settings,
  Sun,
  Moon,
  Lock,
} from 'lucide-react';
import type { TabType } from './BottomNav';
import { useTheme } from '../context/ThemeContext';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  unreadCount?: number;
  onOpenQuickLeadModal?: () => void;
  onLock?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  unreadCount = 0,
  onLock,
}) => {
  const { theme, setTheme } = useTheme();

  const menuItems = [
    {
      id: 'dashboard' as TabType,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'inbox' as TabType,
      label: 'Live Inbox',
      icon: MessageSquare,
      badge: unreadCount > 0 ? unreadCount : null,
    },
    {
      id: 'services' as TabType,
      label: 'Services Catalog',
      icon: Sparkles,
    },
    {
      id: 'settings' as TabType,
      label: 'Settings & Guides',
      icon: Settings,
    },
  ];

  return (
    <aside
      className={`hidden md:flex flex-col w-64 p-5 justify-between shrink-0 select-none font-sans transition-colors duration-200 border-r ${
        theme === 'light'
          ? 'bg-white border-slate-200/80 shadow-sm'
          : 'bg-[#16171A] border-[#26272E]'
      }`}
    >
      {/* Brand Header */}
      <div className="space-y-6">
        <div className="flex items-center space-x-3 px-1">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden shadow-[0_4px_16px_rgba(245,158,11,0.25)] border border-amber-500/20 bg-black/40">
            <img src="/logo.png" alt="Signature Detailing" className="w-full h-full object-contain p-0.5 drop-shadow-md" />
          </div>
          <div>
            <h1
              className={`font-bold text-base tracking-tight leading-tight ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}
            >
              Signature <span className="text-[#5E81F4]">Detailing</span>
            </h1>
            <span
              className={`text-xs font-medium block mt-0.5 ${
                theme === 'light' ? 'text-slate-500' : 'text-zinc-400'
              }`}
            >
              Studio CRM
            </span>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="space-y-1.5">
          <span
            className={`text-xs font-bold tracking-wider uppercase px-3.5 block mb-2.5 ${
              theme === 'light' ? 'text-slate-400' : 'text-zinc-500'
            }`}
          >
            Main Menu
          </span>

          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm transition-all ${
                  isActive
                    ? 'bg-[#5E81F4] text-white shadow-[0_4px_16px_rgba(94,129,244,0.35)] font-semibold'
                    : theme === 'light'
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04] font-medium'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon
                    className={`w-5 h-5 transition-transform ${
                      isActive
                        ? 'scale-105 text-white'
                        : theme === 'light'
                        ? 'text-slate-500'
                        : 'text-zinc-400'
                    }`}
                  />
                  <span className="tracking-normal">{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-red-500 text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Actions */}
      <div
        className={`space-y-3 pt-4 border-t ${
          theme === 'light' ? 'border-slate-200/80' : 'border-[#26272E]'
        }`}
      >
        {/* Day / Night Theme Toggle Switch */}
        <div
          className={`p-1 rounded-xl flex items-center justify-between border transition-all ${
            theme === 'light'
              ? 'bg-slate-100 border-slate-200'
              : 'bg-[#1C1D21] border-[#282930]'
          }`}
        >
          <button
            onClick={() => setTheme('light')}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              theme === 'light'
                ? 'bg-white text-[#5E81F4] shadow-sm font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
            title="Switch to Day Theme"
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Day</span>
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              theme === 'dark'
                ? 'bg-[#2A2B33] text-white shadow-sm font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Switch to Night Theme"
          >
            <Moon className="w-3.5 h-3.5" />
            <span>Night</span>
          </button>
        </div>

        {/* Lock CRM Session */}
        {onLock && (
          <button
            onClick={onLock}
            className={`w-full flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
              theme === 'light'
                ? 'bg-slate-50 hover:bg-rose-50 border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-200'
                : 'bg-[#1C1D21] hover:bg-rose-500/10 border-[#282930] text-zinc-400 hover:text-rose-400 hover:border-rose-500/30'
            }`}
            title="Lock Studio CRM Session"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Lock Terminal</span>
          </button>
        )}
      </div>
    </aside>
  );
};
