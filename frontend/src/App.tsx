import { useState, useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import type { TabType } from './components/BottomNav';
import { DashboardView } from './components/DashboardView';
import { InboxView } from './components/InboxView';
import { ServicesView } from './components/ServicesView';
import { SettingsView } from './components/SettingsView';
import { QuickLeadModal } from './components/QuickLeadModal';
import { LoginModal } from './components/LoginModal';
import type { StudioService } from './types';
import { api } from './lib/api';
import { ThemeProvider, useTheme } from './context/ThemeContext';

function AppContent() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isQuickLeadOpen, setIsQuickLeadOpen] = useState(false);
  const [services, setServices] = useState<StudioService[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [chatCustomerId, setChatCustomerId] = useState<string | null>(null);

  // Simple Studio Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('signature_crm_auth') === 'true';
  });

  const handleLock = () => {
    localStorage.removeItem('signature_crm_auth');
    setIsAuthenticated(false);
  };

  const loadServices = async () => {
    try {
      const data = await api.getServices();
      setServices(data || []);
    } catch (err: any) {
      console.warn('Initial services load notice:', err.message);
    }
  };

  const updateUnreadTotal = async () => {
    if (document.hidden) return;
    try {
      const convs = await api.getConversations();
      const totalUnread = (convs || []).reduce((sum, c) => sum + (c.unread_count || 0), 0);
      setUnreadTotal(totalUnread);
    } catch (err: any) {
      console.warn('Initial unread count notice:', err.message);
    }
  };

  useEffect(() => {
    loadServices();
    updateUnreadTotal();

    const interval = setInterval(updateUnreadTotal, 15000);
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateUnreadTotal();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <div
      className={`flex h-screen w-full select-none overflow-hidden font-sans transition-colors duration-200 ${
        theme === 'light' ? 'bg-[#F8FAFC] text-slate-900' : 'bg-[#16171A] text-white'
      }`}
    >
      {/* Desktop Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab !== 'inbox') setChatCustomerId(null);
          setActiveTab(tab);
        }}
        unreadCount={unreadTotal}
        onOpenQuickLeadModal={() => setIsQuickLeadOpen(true)}
        onLock={handleLock}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col h-full min-h-0 ${
          activeTab === 'inbox'
            ? 'overflow-hidden'
            : 'overflow-y-auto overflow-x-hidden custom-scrollbar'
        }`}
      >
        {/* Mobile Header (Hidden on desktop) */}
        <div className="md:hidden shrink-0">
          <TopBar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onOpenQuickLeadModal={() => setIsQuickLeadOpen(true)}
            onRefresh={() => {
              loadServices();
              updateUnreadTotal();
            }}
            unreadCount={unreadTotal}
            onLock={handleLock}
          />
        </div>

        {/* Main Viewport */}
        <main
          className={`flex-1 flex flex-col w-full max-w-[1600px] mx-auto ${
            activeTab === 'inbox'
              ? 'min-h-0 h-full overflow-hidden'
              : 'min-h-full'
          }`}
        >
          {activeTab === 'dashboard' && (
            <DashboardView
              onNavigateToChat={(customerId) => {
                setChatCustomerId(customerId);
                setActiveTab('inbox');
              }}
              onOpenQuickLead={() => setIsQuickLeadOpen(true)}
            />
          )}
          {activeTab === 'inbox' && (
            <InboxView initialCustomerId={chatCustomerId} />
          )}
          {activeTab === 'services' && <ServicesView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>

        {/* Mobile Bottom Thumb Navigation Bar (Hidden on desktop) */}
        <div className="md:hidden shrink-0">
          <BottomNav
            activeTab={activeTab}
            setActiveTab={(tab) => {
              if (tab !== 'inbox') setChatCustomerId(null);
              setActiveTab(tab);
            }}
            unreadCount={unreadTotal}
          />
        </div>
      </div>

      {/* Quick Lead Modal */}
      <QuickLeadModal
        isOpen={isQuickLeadOpen}
        onClose={() => setIsQuickLeadOpen(false)}
        services={services}
        onLeadCreated={() => {
          updateUnreadTotal();
          setActiveTab('dashboard');
        }}
      />

      {/* Simple Studio Auth Screen */}
      {!isAuthenticated && (
        <LoginModal onSuccess={() => setIsAuthenticated(true)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
