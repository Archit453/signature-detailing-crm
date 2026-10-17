import React from 'react';
import { LayoutDashboard, MessageSquare, Sparkles, Settings } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export type TabType = 'dashboard' | 'inbox' | 'services' | 'settings';

interface BottomNavProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  unreadCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  unreadCount = 0,
}) => {
  const { theme } = useTheme();

  const tabs = [
    {
      id: 'dashboard' as TabType,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'inbox' as TabType,
      label: 'Inbox',
      icon: MessageSquare,
      badge: unreadCount > 0 ? unreadCount : null,
    },
    {
      id: 'services' as TabType,
      label: 'Services',
      icon: Sparkles,
    },
    {
      id: 'settings' as TabType,
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-40 backdrop-blur-md border-t pb-safe font-sans transition-colors duration-200 ${
        theme === 'light'
          ? 'bg-white/95 border-slate-200/80 shadow-lg'
          : 'bg-[#16171A]/95 border-[#26272E]'
      }`}
    >
      <div className="max-w-md md:max-w-4xl mx-auto flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-200 ${
                isActive
                  ? 'text-[#5E81F4] font-semibold'
                  : theme === 'light'
                  ? 'text-slate-500 hover:text-slate-900'
                  : 'text-[#8E92A0] hover:text-white'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive
                      ? 'scale-110 drop-shadow-[0_0_8px_rgba(94,129,244,0.5)] text-[#5E81F4]'
                      : ''
                  }`}
                />
                {tab.badge && (
                  <span className="absolute -top-1.5 -right-2.5 bg-[#5E81F4] text-white text-xs font-bold px-1.5 py-0.2 rounded-full min-w-[16px] text-center shadow">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium mt-1 tracking-tight">{tab.label}</span>
              {isActive && (
                <div className="absolute bottom-1 w-8 h-0.5 bg-[#5E81F4] rounded-full shadow-[0_0_8px_#5E81F4]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
