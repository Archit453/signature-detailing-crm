import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Globe, 
  Settings2,
  Sun,
  Moon,
  Copy,
  Check,
  BadgeCheck,
  ShieldCheck,
  Info,
  Key,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  Save,
  Mail,
  Smartphone,
  Share2,
  Target,
  Sparkles,
  ExternalLink,
  Zap
} from 'lucide-react';
import { InstagramIcon, WhatsAppIcon } from './Icons';
import { api } from '../lib/api';

export const SettingsView: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const isLight = theme === 'light';

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'webhooks' | 'guides' | 'profile' | 'pricing'>('webhooks');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Live Ping Test states
  const [waPingStatus, setWaPingStatus] = useState<'idle' | 'testing' | 'online' | 'error'>('idle');
  const [waPingMsg, setWaPingMsg] = useState<string>('');
  const [igPingStatus, setIgPingStatus] = useState<'idle' | 'testing' | 'online' | 'error'>('idle');
  const [igPingMsg, setIgPingMsg] = useState<string>('');
  const [adLeadSimStatus, setAdLeadSimStatus] = useState<'idle' | 'simulating' | 'success' | 'error'>('idle');
  const [adLeadSimMsg, setAdLeadSimMsg] = useState<string>('');

  // General Studio Settings state
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [studioProfile, setStudioProfile] = useState({
    studio_name: 'Signature Detailing',
    phone: '+91 84568 69931',
    owner_phone: '+91 84568 69931',
    email: 'signaturedetailing.bbsr@gmail.com',
    address: 'Plot no - 55, Pahala, Before Utkal Mahindra Service, Bhubaneswar, Odisha 752101',
    website_url: 'https://signature-detailing-landing-page.signaturedetailing-bbsr.workers.dev/',
    google_maps_link: 'https://maps.app.goo.gl/TP4S4MommkGLpAzP7',
    google_review_link: 'https://search.google.com/local/writereview?placeid=ChIJey82fSsLGToRc9YiRRlQJ2Q'
  });

  // Integrations state
  const [integrationsData, setIntegrationsData] = useState<any>(null);
  const [isEditingTokens, setIsEditingTokens] = useState(false);
  const [isSavingTokens, setIsSavingTokens] = useState(false);
  const [tokensSuccessMsg, setTokensSuccessMsg] = useState('');
  const [tokenInputs, setTokenInputs] = useState({
    whatsapp_phone_number_id: '',
    whatsapp_token: '',
    whatsapp_verify_token: 'signature_wa_verify_secret',
    instagram_page_id: '',
    instagram_page_access_token: '',
    instagram_verify_token: 'signature_ig_verify_secret'
  });

  const crmOrigin = typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')
    ? window.location.origin
    : 'https://signature-detailing-crm.vercel.app';

  const whatsappWebhookUrl = `${crmOrigin}/api/webhooks/whatsapp`;
  const instagramWebhookUrl = `${crmOrigin}/api/webhooks/instagram`;
  const leadAdWebhookUrl = `${crmOrigin}/api/webhooks/ads/lead`;

  // Fetch settings from database on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [genRes, intRes] = await Promise.all([
        api.getGeneralSettings().catch(() => null),
        api.getIntegrations().catch(() => null)
      ]);

      const genData = genRes?.data !== undefined ? genRes.data : genRes;
      const intData = intRes?.data !== undefined ? intRes.data : intRes;

      if (genData && typeof genData === 'object') {
        setStudioProfile(prev => ({
          ...prev,
          ...genData
        }));
      }

      if (intData && typeof intData === 'object') {
        setIntegrationsData(intData);
        setTokenInputs({
          whatsapp_phone_number_id: intData.whatsapp?.phone_number_id || '',
          whatsapp_token: '',
          whatsapp_verify_token: intData.whatsapp?.verify_token || 'signature_wa_verify_secret',
          instagram_page_id: intData.instagram?.page_id || '',
          instagram_page_access_token: '',
          instagram_verify_token: intData.instagram?.verify_token || 'signature_ig_verify_secret'
        });
      }
    } catch (e) {
      console.warn('Error loading settings:', e);
    }
  };

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const CopyButton = ({ id, text }: { id: string; text: string }) => (
    <button
      onClick={() => handleCopy(id, text)}
      className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium ${
        isLight 
          ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50' 
          : 'text-slate-400 hover:text-amber-400 hover:bg-amber-500/10'
      }`}
      title="Copy to clipboard"
    >
      {copiedKey === id ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-emerald-500 text-[11px]">Copied</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          <span className="text-[11px]">Copy</span>
        </>
      )}
    </button>
  );

  // Live Ping Handshake Testers
  const testWhatsAppWebhook = async () => {
    setWaPingStatus('testing');
    setWaPingMsg('');
    try {
      const res = await fetch(whatsappWebhookUrl);
      const data = await res.json();
      if (res.ok && data.status === 'online') {
        setWaPingStatus('online');
        setWaPingMsg(`Online (HTTP ${res.status}): Ready for Meta Webhooks`);
        loadSettings();
      } else {
        setWaPingStatus('error');
        setWaPingMsg(`Unexpected response (HTTP ${res.status})`);
      }
    } catch (err: any) {
      setWaPingStatus('error');
      setWaPingMsg(err.message || 'Network error reaching webhook endpoint');
    }
  };

  const [subscribingAds, setSubscribingAds] = useState(false);
  const [subscribingAdsResult, setSubscribingAdsResult] = useState<{ success: boolean; msg: string; tip?: string } | null>(null);

  const [testLeadForm, setTestLeadForm] = useState({
    name: 'Rahul Sharma (Test Ad Lead)',
    phone: '9861201770',
    service: 'Ceramic Coating',
    vehicle: 'Mahindra Thar Roxx',
    email: 'rahul.thar@example.com',
  });

  const handleAutoSubscribeLeadAds = async () => {
    setSubscribingAds(true);
    setSubscribingAdsResult(null);
    try {
      const res = await api.subscribeLeadAds();
      if (res && res.success) {
        setSubscribingAdsResult({
          success: true,
          msg: 'Page successfully subscribed to Lead Ads Webhooks (leadgen field active)!',
        });
      } else {
        setSubscribingAdsResult({
          success: false,
          msg: res?.error || 'Meta API rejected subscription',
          tip: res?.tip || 'Ensure your Meta App has the "leads_retrieval" and "pages_manage_ads" permissions granted in Meta App Review / Permissions.',
        });
      }
    } catch (err: any) {
      setSubscribingAdsResult({
        success: false,
        msg: err.message || 'Network error communicating with server',
      });
    } finally {
      setSubscribingAds(false);
    }
  };

  const handleSimulateAdLead = async () => {
    setAdLeadSimStatus('simulating');
    setAdLeadSimMsg('');
    try {
      const res = await api.simulateAdLead(testLeadForm);
      if (res && res.success) {
        setAdLeadSimStatus('success');
        setAdLeadSimMsg(`Captured Lead #${res.lead?.id ? String(res.lead.id).slice(0, 8) : 'OK'} for ${testLeadForm.name}! Check Leads Kanban & Inbox.`);
      } else {
        setAdLeadSimStatus('error');
        setAdLeadSimMsg('Simulation failed');
      }
    } catch (e: any) {
      setAdLeadSimStatus('error');
      setAdLeadSimMsg(e.message || 'Simulation network error');
    }
  };

  const testInstagramWebhook = async () => {
    setIgPingStatus('testing');
    setIgPingMsg('');
    try {
      const res = await fetch(instagramWebhookUrl);
      const data = await res.json();
      if (res.ok && data.status === 'online') {
        setIgPingStatus('online');
        setIgPingMsg(`Online (HTTP ${res.status}): Verified Handshake Ready`);
        loadSettings();
      } else {
        setIgPingStatus('error');
        setIgPingMsg(`Unexpected response (HTTP ${res.status})`);
      }
    } catch (err: any) {
      setIgPingStatus('error');
      setIgPingMsg(err.message || 'Network error reaching webhook endpoint');
    }
  };

  // Save Studio Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSuccessMsg('');
    try {
      await api.saveGeneralSettings(studioProfile);
      setProfileSuccessMsg('Studio profile updated successfully! Bot replies and cards will use these details.');
      setTimeout(() => setProfileSuccessMsg(''), 4000);
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Save API Tokens
  const handleSaveTokens = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingTokens(true);
    setTokensSuccessMsg('');
    try {
      await api.saveIntegrations({
        whatsapp: {
          phone_number_id: tokenInputs.whatsapp_phone_number_id,
          token: tokenInputs.whatsapp_token || undefined,
          verify_token: tokenInputs.whatsapp_verify_token
        },
        instagram: {
          page_id: tokenInputs.instagram_page_id,
          page_access_token: tokenInputs.instagram_page_access_token || undefined,
          verify_token: tokenInputs.instagram_verify_token
        }
      });
      setTokensSuccessMsg('Meta API tokens saved securely! The bot is active with updated credentials.');
      setIsEditingTokens(false);
      loadSettings();
      setTimeout(() => setTokensSuccessMsg(''), 4000);
    } catch (err: any) {
      alert(`Failed to save tokens: ${err.message}`);
    } finally {
      setIsSavingTokens(false);
    }
  };

  return (
    <div className={`p-4 sm:p-6 max-w-5xl mx-auto font-sans min-h-screen transition-colors duration-200 ${
      isLight ? 'text-slate-900' : 'text-slate-100'
    }`}>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Settings2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Settings & Guides</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Centralized studio profile, live Meta endpoints, and step-by-step connection guides.
              </p>
            </div>
          </div>
        </div>
        
        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(isLight ? 'dark' : 'light')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border font-semibold text-xs transition-all self-start sm:self-auto ${
            isLight
              ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
              : 'bg-slate-900/50 border-slate-800 text-slate-300 hover:bg-slate-800'
          }`}
        >
          {isLight ? <Moon className="w-3.5 h-3.5 text-slate-600" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
          <span>{isLight ? 'Dark Mode' : 'Light Mode'}</span>
        </button>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800/80">
        <button
          onClick={() => setActiveTab('webhooks')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all shrink-0 ${
            activeTab === 'webhooks'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
              : isLight
                ? 'text-slate-600 hover:bg-slate-100'
                : 'text-slate-400 hover:bg-slate-850'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>Webhooks & API Credentials</span>
        </button>

        <button
          onClick={() => setActiveTab('guides')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all shrink-0 ${
            activeTab === 'guides'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
              : isLight
                ? 'text-slate-600 hover:bg-slate-100'
                : 'text-slate-400 hover:bg-slate-850'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Meta Setup Guides</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-pink-500/10 text-pink-500 border border-pink-500/20 font-bold">
            Fix Bot
          </span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all shrink-0 ${
            activeTab === 'profile'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
              : isLight
                ? 'text-slate-600 hover:bg-slate-100'
                : 'text-slate-400 hover:bg-slate-850'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Studio Profile</span>
        </button>

        <button
          onClick={() => setActiveTab('pricing')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all shrink-0 ${
            activeTab === 'pricing'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
              : isLight
                ? 'text-slate-600 hover:bg-slate-100'
                : 'text-slate-400 hover:bg-slate-850'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Meta Pricing & Transparency</span>
        </button>
      </div>

      {/* TAB CONTENT */}
      <div className="mt-6 space-y-6">

        {/* ============================================================== */}
        {/* TAB 1: WEBHOOKS & CREDENTIALS                                 */}
        {/* ============================================================== */}
        {activeTab === 'webhooks' && (
          <div className="space-y-6">
            {tokensSuccessMsg && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{tokensSuccessMsg}</span>
              </div>
            )}

            {/* Live Webhook Endpoints */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 px-1 flex items-center justify-between">
                <span>Live Meta Webhook Endpoints (Copy & Paste to Meta Portal)</span>
                <span className="text-[11px] text-emerald-500 font-medium normal-case flex items-center gap-1">
                  <BadgeCheck className="w-3.5 h-3.5" /> Instant Handshake Ready
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* WhatsApp Webhook Card */}
                <div className={`p-5 rounded-2xl border transition-all ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/50 border-slate-800'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#25D366]/10 flex items-center justify-center shrink-0">
                        <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-[#25D366]">WhatsApp Cloud API</h3>
                          {integrationsData?.whatsapp?.is_connected && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              {integrationsData.whatsapp.account_name}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {integrationsData?.whatsapp?.is_connected
                            ? `Connected Business: ${integrationsData.whatsapp.account_name}`
                            : 'Meta Callback & Verification'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={testWhatsAppWebhook}
                      disabled={waPingStatus === 'testing'}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 hover:border-[#25D366] transition-colors"
                    >
                      <RefreshCw className={`w-3 h-3 ${waPingStatus === 'testing' ? 'animate-spin' : ''}`} />
                      <span>{waPingStatus === 'testing' ? 'Pinging...' : 'Test Handshake'}</span>
                    </button>
                  </div>

                  {waPingStatus === 'online' && (
                    <div className="mb-3 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{waPingMsg}</span>
                    </div>
                  )}
                  {waPingStatus === 'error' && (
                    <div className="mb-3 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{waPingMsg}</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium mb-1">Callback URL (Webhook)</div>
                      <div className={`flex items-center justify-between p-2.5 rounded-xl border ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
                      }`}>
                        <code className="text-[11px] font-mono text-slate-700 dark:text-slate-300 truncate select-all mr-2">
                          {whatsappWebhookUrl}
                        </code>
                        <CopyButton id="wa-url" text={whatsappWebhookUrl} />
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-400 font-medium mb-1">Verify Token</div>
                      <div className={`flex items-center justify-between p-2.5 rounded-xl border ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
                      }`}>
                        <code className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 select-all">
                          {tokenInputs.whatsapp_verify_token}
                        </code>
                        <CopyButton id="wa-token" text={tokenInputs.whatsapp_verify_token} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Instagram Webhook Card */}
                <div className={`p-5 rounded-2xl border transition-all ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/50 border-slate-800'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center shrink-0">
                        <InstagramIcon className="w-4 h-4 text-pink-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-pink-500">Instagram Graph API</h3>
                          {integrationsData?.instagram?.is_connected ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 flex items-center gap-1 shadow-sm">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              @{integrationsData.instagram.account_name}
                            </span>
                          ) : integrationsData?.instagram?.has_token ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-medium border border-amber-500/20">
                              Verifying...
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-400 font-medium">
                              Not Connected
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {integrationsData?.instagram?.is_connected
                            ? `Connected Account: @${integrationsData.instagram.account_name}`
                            : 'Direct Messages & Comments'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={testInstagramWebhook}
                      disabled={igPingStatus === 'testing'}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 hover:border-pink-500 transition-colors"
                    >
                      <RefreshCw className={`w-3 h-3 ${igPingStatus === 'testing' ? 'animate-spin' : ''}`} />
                      <span>{igPingStatus === 'testing' ? 'Pinging...' : 'Test Handshake'}</span>
                    </button>
                  </div>

                  {igPingStatus === 'online' && (
                    <div className="mb-3 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{igPingMsg}</span>
                    </div>
                  )}
                  {igPingStatus === 'error' && (
                    <div className="mb-3 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{igPingMsg}</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium mb-1">Callback URL (Webhook)</div>
                      <div className={`flex items-center justify-between p-2.5 rounded-xl border ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
                      }`}>
                        <code className="text-[11px] font-mono text-slate-700 dark:text-slate-300 truncate select-all mr-2">
                          {instagramWebhookUrl}
                        </code>
                        <CopyButton id="ig-url" text={instagramWebhookUrl} />
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-400 font-medium mb-1">Verify Token</div>
                      <div className={`flex items-center justify-between p-2.5 rounded-xl border ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
                      }`}>
                        <code className="text-xs font-mono font-bold text-pink-600 dark:text-pink-400 select-all">
                          {tokenInputs.instagram_verify_token}
                        </code>
                        <CopyButton id="ig-token" text={tokenInputs.instagram_verify_token} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Instagram & Meta Ad Forms (Lead Ads) Card */}
                <div className={`p-5 rounded-2xl border transition-all ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/50 border-slate-800'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                        <Target className="w-4 h-4 text-indigo-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-indigo-500">Instagram Ad Forms</h3>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 font-bold border border-indigo-500/20">
                            100% Dynamic
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">Meta Instant Forms & Paid Ads</p>
                      </div>
                    </div>

                    <button
                      onClick={handleSimulateAdLead}
                      disabled={adLeadSimStatus === 'simulating'}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 transition-colors text-indigo-500"
                    >
                      <Sparkles className={`w-3 h-3 ${adLeadSimStatus === 'simulating' ? 'animate-spin' : ''}`} />
                      <span>{adLeadSimStatus === 'simulating' ? 'Simulating...' : 'Simulate Lead'}</span>
                    </button>
                  </div>

                  {adLeadSimStatus === 'success' && (
                    <div className="mb-3 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{adLeadSimMsg}</span>
                    </div>
                  )}
                  {adLeadSimStatus === 'error' && (
                    <div className="mb-3 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{adLeadSimMsg}</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium mb-1">Direct Ad Webhook URL</div>
                      <div className={`flex items-center justify-between p-2.5 rounded-xl border ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
                      }`}>
                        <code className="text-[11px] font-mono text-slate-700 dark:text-slate-300 truncate select-all mr-2">
                          {leadAdWebhookUrl}
                        </code>
                        <CopyButton id="lead-ad-url" text={leadAdWebhookUrl} />
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-400 font-medium mb-1">Universal Field Normalizer</div>
                      <div className={`p-2 rounded-xl border text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
                      }`}>
                        ⚡ Auto-maps Name, Phone, Car Model & Service from any ad agency question wording without manual mapping.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Direct API Token Manager Card */}
            <div className={`p-6 rounded-2xl border ${
              isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/50 border-slate-800'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-500" />
                    Meta API Access Tokens (Database Storage)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Update WhatsApp & Instagram access tokens directly. No Vercel environment variable rebuilds required.
                  </p>
                </div>

                <button
                  onClick={() => setIsEditingTokens(!isEditingTokens)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isEditingTokens
                      ? 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                      : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                  }`}
                >
                  {isEditingTokens ? 'Cancel' : 'Update Tokens'}
                </button>
              </div>

              {!isEditingTokens ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div className={`p-4 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'}`}>
                    <div className="text-xs font-semibold text-slate-400 mb-1 flex items-center justify-between">
                      <span>WhatsApp Business Account</span>
                      {integrationsData?.whatsapp?.is_connected ? (
                        <span className="text-emerald-500 text-[10px] flex items-center gap-1 font-bold">
                          <Check className="w-3 h-3" /> VERIFIED
                        </span>
                      ) : integrationsData?.whatsapp?.has_token ? (
                        <span className="text-amber-500 text-[10px] font-bold">TOKEN ACTIVE</span>
                      ) : (
                        <span className="text-slate-400 text-[10px] font-bold">TOKEN REQUIRED</span>
                      )}
                    </div>
                    <div className="font-bold text-sm text-[#25D366] flex items-center gap-2">
                      {integrationsData?.whatsapp?.is_connected ? (
                        <>
                          <span className="truncate">{integrationsData.whatsapp.account_name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold shrink-0">LIVE</span>
                        </>
                      ) : (
                        <span className="font-mono text-xs text-slate-400">{tokenInputs.whatsapp_phone_number_id || 'Not Configured'}</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 truncate">
                      Phone ID: {tokenInputs.whatsapp_phone_number_id || 'None'} • Token: {integrationsData?.whatsapp?.token_preview || 'None'}
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'}`}>
                    <div className="text-xs font-semibold text-slate-400 mb-1 flex items-center justify-between">
                      <span>Instagram Account</span>
                      {integrationsData?.instagram?.is_connected ? (
                        <span className="text-emerald-500 text-[10px] flex items-center gap-1 font-bold">
                          <Check className="w-3 h-3" /> VERIFIED
                        </span>
                      ) : integrationsData?.instagram?.has_token ? (
                        <span className="text-amber-500 text-[10px] font-bold">TOKEN ACTIVE</span>
                      ) : (
                        <span className="text-slate-400 text-[10px] font-bold">TOKEN REQUIRED</span>
                      )}
                    </div>
                    <div className="font-bold text-sm text-pink-500 flex items-center gap-2">
                      {integrationsData?.instagram?.is_connected ? (
                        <>
                          <span>@{integrationsData.instagram.account_name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold shrink-0">CONNECTED</span>
                        </>
                      ) : (
                        <span className="font-mono text-xs text-slate-400">{tokenInputs.instagram_page_id || 'Not Configured'}</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 truncate">
                      Page ID: {tokenInputs.instagram_page_id || 'None'} • Token: {integrationsData?.instagram?.token_preview || 'None'}
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveTokens} className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        WhatsApp Phone Number ID
                      </label>
                      <input
                        type="text"
                        value={tokenInputs.whatsapp_phone_number_id}
                        onChange={(e) => setTokenInputs({ ...tokenInputs, whatsapp_phone_number_id: e.target.value })}
                        placeholder="e.g. 1344182455438369"
                        className={`w-full px-3 py-2 text-xs font-mono rounded-xl border ${
                          isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-700'
                        } focus:outline-none focus:ring-2 focus:ring-amber-500`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        WhatsApp Permanent Access Token
                      </label>
                      <input
                        type="password"
                        value={tokenInputs.whatsapp_token}
                        onChange={(e) => setTokenInputs({ ...tokenInputs, whatsapp_token: e.target.value })}
                        placeholder="Leave blank to keep current token"
                        className={`w-full px-3 py-2 text-xs font-mono rounded-xl border ${
                          isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-700'
                        } focus:outline-none focus:ring-2 focus:ring-amber-500`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Instagram Business Account ID (IG User ID)
                      </label>
                      <p className="text-[10px] text-slate-400 mb-1.5">
                        Your 17-digit Instagram Business Account ID shown in Meta App Dashboard (e.g. 17841436820921802).
                      </p>
                      <input
                        type="text"
                        value={tokenInputs.instagram_page_id}
                        onChange={(e) => setTokenInputs({ ...tokenInputs, instagram_page_id: e.target.value })}
                        placeholder="e.g. 17841436820921802"
                        className={`w-full px-3 py-2 text-xs font-mono rounded-xl border ${
                          isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-700'
                        } focus:outline-none focus:ring-2 focus:ring-amber-500`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Instagram Page Access Token
                      </label>
                      <input
                        type="password"
                        value={tokenInputs.instagram_page_access_token}
                        onChange={(e) => setTokenInputs({ ...tokenInputs, instagram_page_access_token: e.target.value })}
                        placeholder="Leave blank to keep current token"
                        className={`w-full px-3 py-2 text-xs font-mono rounded-xl border ${
                          isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-700'
                        } focus:outline-none focus:ring-2 focus:ring-amber-500`}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingTokens(false)}
                      className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingTokens}
                      className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSavingTokens ? 'Saving...' : 'Save Credentials'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Meta App Review Compliance Documents Card */}
            <div className={`p-6 rounded-2xl border ${
              isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/50 border-slate-800'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-sm">Meta App Review Compliance Documents</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 font-bold">
                  Live on Vercel
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Meta requires these public compliance URLs during App Review and in <strong>App Settings → Basic</strong>. Copy and paste them directly into your Meta developer console.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'}`}>
                  <div className="text-[11px] font-semibold text-slate-400 mb-1">Privacy Policy URL</div>
                  <div className="flex items-center justify-between">
                    <a href={`${crmOrigin}/privacy`} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 font-medium hover:underline truncate mr-2">
                      {crmOrigin}/privacy
                    </a>
                    <CopyButton id="comp-privacy" text={`${crmOrigin}/privacy`} />
                  </div>
                </div>

                <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'}`}>
                  <div className="text-[11px] font-semibold text-slate-400 mb-1">Terms of Service URL</div>
                  <div className="flex items-center justify-between">
                    <a href={`${crmOrigin}/terms`} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 font-medium hover:underline truncate mr-2">
                      {crmOrigin}/terms
                    </a>
                    <CopyButton id="comp-terms" text={`${crmOrigin}/terms`} />
                  </div>
                </div>

                <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'}`}>
                  <div className="text-[11px] font-semibold text-slate-400 mb-1">User Data Deletion URL</div>
                  <div className="flex items-center justify-between">
                    <a href={`${crmOrigin}/data-deletion`} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 font-medium hover:underline truncate mr-2">
                      {crmOrigin}/data-deletion
                    </a>
                    <CopyButton id="comp-deletion" text={`${crmOrigin}/data-deletion`} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: META SETUP GUIDES                                      */}
        {/* ============================================================== */}
        {activeTab === 'guides' && (
          <div className="space-y-6">

            {/* Instagram Setup Guide (Fixing the Bot) */}
            <div className={`p-6 rounded-2xl border ${
              isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/50 border-slate-800'
            }`}>
              <div className="flex items-center gap-2.5 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center shrink-0">
                  <InstagramIcon className="w-4 h-4 text-pink-500" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-pink-500">Instagram Bot Connection Guide</h3>
                  <p className="text-xs text-slate-400">Follow these 4 steps to ensure Instagram DMs trigger the bot.</p>
                </div>
              </div>

              {/* CRITICAL ALERT BOX: Allow access to messages */}
              <div className="mt-5 p-4 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-pink-500 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                  <strong className="text-pink-500 block mb-1">CRITICAL STEP: Turn ON "Allow Access to Messages" in Mobile App</strong>
                  Instagram blocks third-party apps by default until you toggle this in the phone app:
                  <ol className="list-decimal ml-4 mt-1.5 space-y-1 font-medium">
                    <li>Open Instagram app on the phone logged in as <strong>@signaturedetailing.bbsr</strong>.</li>
                    <li>Go to <strong>Settings and privacy → Messages and story replies</strong>.</li>
                    <li>Under <strong>Connected tools</strong>, tap <strong>Allow access to messages</strong> and toggle it <strong>ON</strong>.</li>
                  </ol>
                </div>
              </div>

              <div className="mt-6 space-y-4 text-xs">
                {/* Step 1 */}
                <div className={`p-4 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'}`}>
                  <div className="font-bold text-sm text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-pink-500/20 text-pink-500 flex items-center justify-center text-xs font-mono">1</span>
                    Professional / Business Account Setup
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed ml-7">
                    Ensure your Instagram handle is switched to a <strong>Professional (Business) account</strong> and connected to your official Facebook Business Page inside Meta Business Suite.
                  </p>
                </div>

                {/* Step 2 */}
                <div className={`p-4 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'}`}>
                  <div className="font-bold text-sm text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-pink-500/20 text-pink-500 flex items-center justify-center text-xs font-mono">2</span>
                    Configure Meta Developer Webhook
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed ml-7">
                    In <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-pink-500 underline">Meta Developer Portal</a>, go to <strong>Signature CRM → Instagram → Webhooks</strong>:
                  </p>
                  <ul className="list-disc ml-11 mt-1.5 space-y-1 text-slate-600 dark:text-slate-300">
                    <li>Callback URL: <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded">{instagramWebhookUrl}</code></li>
                    <li>Verify Token: <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded">{tokenInputs.instagram_verify_token}</code></li>
                    <li>Click <strong>Verify and Save</strong>.</li>
                    <li>Under Subscribed Fields, subscribe to: <strong>messages</strong>, <strong>messaging_postbacks</strong>, and <strong>comments</strong>.</li>
                  </ul>
                </div>

                {/* Step 3 */}
                <div className={`p-4 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'}`}>
                  <div className="font-bold text-sm text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-pink-500/20 text-pink-500 flex items-center justify-center text-xs font-mono">3</span>
                    Add Instagram Testers (For Testing Before App Review)
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed ml-7">
                    While the Meta App is in <strong>Development Mode (Unpublished)</strong>, Meta will <em>only</em> deliver messages from approved testers:
                  </p>
                  <ul className="list-disc ml-11 mt-1.5 space-y-1 text-slate-600 dark:text-slate-300">
                    <li>In Meta Developers, go to <strong>App Roles → Roles</strong> (or <strong>Instagram Testers</strong>).</li>
                    <li>Click <strong>Add Instagram Testers</strong> and enter your testing Instagram handle.</li>
                    <li>On that tester's phone, open Instagram → <strong>Settings → Apps and websites → Tester invites</strong> → tap <strong>Accept</strong>.</li>
                    <li>Now send "Hi" in DM to test the 3-step booking bot!</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* WhatsApp Setup Guide */}
            <div className={`p-6 rounded-2xl border ${
              isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/50 border-slate-800'
            }`}>
              <div className="flex items-center gap-2.5 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-[#25D366]/10 flex items-center justify-center shrink-0">
                  <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#25D366]">WhatsApp Cloud API Guide</h3>
                  <p className="text-xs text-slate-400">Direct integration with Meta Cloud API servers.</p>
                </div>
              </div>

              <div className="mt-5 space-y-3 text-xs">
                <div className={`p-4 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'}`}>
                  <div className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                    1. Meta Business Verification & Phone Number
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                    Under Meta WhatsApp Manager, add the studio phone number (+91 84568 69931) and complete Business Verification using business registration proof to enable unlimited daily messaging tiers.
                  </p>
                </div>

                <div className={`p-4 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'}`}>
                  <div className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                    2. Webhook Callback & Subscriptions
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                    Under WhatsApp → Configuration, enter the Callback URL <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded">{whatsappWebhookUrl}</code> and Verify Token <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded">{tokenInputs.whatsapp_verify_token}</code>. Subscribe to the <strong>messages</strong> field.
                  </p>
                </div>
              </div>
            </div>

            {/* Instagram Lead Ads (Instant Forms) Guide */}
            <div className={`p-6 rounded-2xl border ${
              isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/50 border-slate-800'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                    <Target className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-indigo-500">Instagram & Facebook Lead Ads (Instant Forms)</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 font-bold border border-indigo-500/20">
                        Live Connection
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Direct real-time lead capture from Instagram Ads into CRM with instant WhatsApp confirmation.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    onClick={handleAutoSubscribeLeadAds}
                    disabled={subscribingAds}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-60"
                  >
                    <Zap className={`w-3.5 h-3.5 ${subscribingAds ? 'animate-spin' : ''}`} />
                    <span>{subscribingAds ? 'Subscribing...' : 'Auto-Subscribe Page'}</span>
                  </button>

                  <a
                    href="https://developers.facebook.com/apps/"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:border-indigo-500 transition-colors text-slate-700 dark:text-slate-300 flex items-center gap-1"
                  >
                    <span>Meta Apps</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                </div>
              </div>

              {subscribingAdsResult && (
                <div className={`mt-4 p-3.5 rounded-xl text-xs border leading-relaxed ${
                  subscribingAdsResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                }`}>
                  <div className="flex items-center gap-2 font-bold">
                    {subscribingAdsResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>{subscribingAdsResult.msg}</span>
                  </div>
                  {subscribingAdsResult.tip && (
                    <div className="mt-1 ml-6 text-[11px] text-slate-500 dark:text-slate-400">
                      💡 {subscribingAdsResult.tip}
                    </div>
                  )}
                </div>
              )}

              {/* Copyable Webhook Credentials Box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-5 text-xs">
                <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">1. Webhook Callback URL (Meta Portal)</span>
                    <span className="text-[10px] text-indigo-500 font-mono font-bold">Field: leadgen</span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <code className="font-mono text-[11px] text-slate-800 dark:text-slate-200 truncate mr-2 select-all">
                      {instagramWebhookUrl}
                    </code>
                    <CopyButton id="guide-ig-webhook" text={instagramWebhookUrl} />
                  </div>
                </div>

                <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">2. Verify Token</span>
                    <span className="text-[10px] text-slate-400 font-mono">Secret Handshake</span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <code className="font-mono text-[11px] font-bold text-pink-500 truncate mr-2 select-all">
                      {tokenInputs.instagram_verify_token}
                    </code>
                    <CopyButton id="guide-ig-token" text={tokenInputs.instagram_verify_token} />
                  </div>
                </div>
              </div>

              {/* Step-by-Step Checklist */}
              <div className="mt-5 space-y-3 text-xs">
                <div className={`p-4 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'}`}>
                  <div className="font-bold text-sm text-slate-900 dark:text-white mb-1.5 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-500 flex items-center justify-center text-xs font-mono">1</span>
                    Configure Webhook on Meta Developer Dashboard
                  </div>
                  <ol className="list-decimal ml-8 mt-1 space-y-1.5 text-slate-600 dark:text-slate-300 leading-relaxed">
                    <li>
                      Open <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="text-indigo-500 underline font-medium">Meta Developer Portal</a> and select your registered App.
                    </li>
                    <li>
                      In the left sidebar, click <strong>Webhooks</strong>. At the top dropdown, switch the object to <strong>Page</strong>.
                    </li>
                    <li>
                      Click <strong>Subscribe to this object</strong> (or <em>Edit Subscription</em>). Paste the <strong>Callback URL</strong> and <strong>Verify Token</strong> above, then click <strong>Verify and Save</strong>.
                    </li>
                    <li>
                      In the fields table below, locate <strong>leadgen</strong> and click <strong>Subscribe</strong>.
                    </li>
                    <li>
                      Under <em>"Hooking up your Page"</em>, select your Facebook Page and click <strong>Subscribe</strong> (or click the <strong>Auto-Subscribe Page</strong> button above!).
                    </li>
                  </ol>
                </div>

                <div className={`p-4 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'}`}>
                  <div className="font-bold text-sm text-slate-900 dark:text-white mb-1.5 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-500 flex items-center justify-center text-xs font-mono">2</span>
                    Required Meta App Permissions
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 ml-7 leading-relaxed">
                    Ensure your connected Meta User / System User token has these 3 permissions granted:
                  </p>
                  <div className="flex flex-wrap gap-2 ml-7 mt-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-500 font-mono text-[11px] font-semibold border border-indigo-500/20">leads_retrieval</span>
                    <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-500 font-mono text-[11px] font-semibold border border-indigo-500/20">pages_manage_ads</span>
                    <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-500 font-mono text-[11px] font-semibold border border-indigo-500/20">pages_show_list</span>
                  </div>
                </div>

                {/* Interactive Live Lead Simulator Form */}
                <div className={`p-4 rounded-xl border ${isLight ? 'bg-indigo-50/50 border-indigo-200' : 'bg-indigo-950/20 border-indigo-800/50'}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        Test Ad Lead Ingestion (Sandbox & Live Simulation)
                      </span>
                    </div>

                    <a
                      href="https://developers.facebook.com/tools/lead-ads-testing"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-indigo-500 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span>Official Meta Testing Tool</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                    Customize test lead values and click <strong>Send Test Lead</strong> to verify instant WhatsApp greeting and CRM lead capture:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Prospect Name</label>
                      <input
                        type="text"
                        value={testLeadForm.name}
                        onChange={(e) => setTestLeadForm({ ...testLeadForm, name: e.target.value })}
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border ${
                          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">WhatsApp Mobile Number</label>
                      <input
                        type="text"
                        value={testLeadForm.phone}
                        onChange={(e) => setTestLeadForm({ ...testLeadForm, phone: e.target.value })}
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border ${
                          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Vehicle Make / Model</label>
                      <input
                        type="text"
                        value={testLeadForm.vehicle}
                        onChange={(e) => setTestLeadForm({ ...testLeadForm, vehicle: e.target.value })}
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border ${
                          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Selected Service</label>
                      <select
                        value={testLeadForm.service}
                        onChange={(e) => setTestLeadForm({ ...testLeadForm, service: e.target.value })}
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border ${
                          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                        }`}
                      >
                        <option value="Ceramic Coating">Ceramic Coating</option>
                        <option value="PPF (Paint Protection Film)">Paint Protection Film (PPF)</option>
                        <option value="Deep Interior Spa">Deep Interior Spa</option>
                        <option value="Paint Correction & Polish">Paint Correction & Polish</option>
                        <option value="Graphene Coating">Graphene Coating</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={handleSimulateAdLead}
                      disabled={adLeadSimStatus === 'simulating'}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-60"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${adLeadSimStatus === 'simulating' ? 'animate-spin' : ''}`} />
                      <span>{adLeadSimStatus === 'simulating' ? 'Simulating...' : 'Send Test Lead'}</span>
                    </button>

                    {adLeadSimStatus === 'success' && (
                      <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{adLeadSimMsg}</span>
                      </div>
                    )}
                    {adLeadSimStatus === 'error' && (
                      <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-1.5 font-medium">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{adLeadSimMsg}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: STUDIO PROFILE (EDITABLE)                              */}
        {/* ============================================================== */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {profileSuccessMsg && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{profileSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className={`p-6 rounded-2xl border ${
              isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/50 border-slate-800'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-amber-500" />
                    Studio Profile Details
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    These details are used across chatbot responses, location cards, and customer alerts.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all flex items-center gap-1.5 self-start sm:self-auto shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingProfile ? 'Saving...' : 'Save Profile'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-amber-500" /> Studio Name
                  </label>
                  <input
                    type="text"
                    value={studioProfile.studio_name}
                    onChange={(e) => setStudioProfile({ ...studioProfile, studio_name: e.target.value })}
                    required
                    className={`w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-700'
                    } focus:outline-none focus:ring-2 focus:ring-amber-500`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-emerald-500" /> Website URL
                  </label>
                  <input
                    type="url"
                    value={studioProfile.website_url}
                    onChange={(e) => setStudioProfile({ ...studioProfile, website_url: e.target.value })}
                    required
                    className={`w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-700'
                    } focus:outline-none focus:ring-2 focus:ring-amber-500`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-blue-500" /> Customer Phone & WhatsApp
                  </label>
                  <input
                    type="text"
                    value={studioProfile.phone}
                    onChange={(e) => setStudioProfile({ ...studioProfile, phone: e.target.value })}
                    required
                    className={`w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-700'
                    } focus:outline-none focus:ring-2 focus:ring-amber-500`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-indigo-500" /> Owner Alert Phone (Receives Inbound Leads)
                  </label>
                  <input
                    type="text"
                    value={studioProfile.owner_phone}
                    onChange={(e) => setStudioProfile({ ...studioProfile, owner_phone: e.target.value })}
                    required
                    className={`w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-700'
                    } focus:outline-none focus:ring-2 focus:ring-amber-500`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-rose-500" /> Studio Email Address
                  </label>
                  <input
                    type="email"
                    value={studioProfile.email}
                    onChange={(e) => setStudioProfile({ ...studioProfile, email: e.target.value })}
                    required
                    className={`w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-700'
                    } focus:outline-none focus:ring-2 focus:ring-amber-500`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-purple-500" /> Google Maps Link
                  </label>
                  <input
                    type="url"
                    value={studioProfile.google_maps_link}
                    onChange={(e) => setStudioProfile({ ...studioProfile, google_maps_link: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-700'
                    } focus:outline-none focus:ring-2 focus:ring-amber-500`}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-500" /> Physical Studio Address
                  </label>
                  <input
                    type="text"
                    value={studioProfile.address}
                    onChange={(e) => setStudioProfile({ ...studioProfile, address: e.target.value })}
                    required
                    className={`w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-700'
                    } focus:outline-none focus:ring-2 focus:ring-amber-500`}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-amber-500" /> Google 5-Star Review Link
                  </label>
                  <input
                    type="url"
                    value={studioProfile.google_review_link}
                    onChange={(e) => setStudioProfile({ ...studioProfile, google_review_link: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-700'
                    } focus:outline-none focus:ring-2 focus:ring-amber-500`}
                  />
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: META PRICING & TRANSPARENCY                            */}
        {/* ============================================================== */}
        {activeTab === 'pricing' && (
          <div className="space-y-6">
            <div className={`rounded-2xl border p-6 transition-all ${
              isLight 
                ? 'bg-gradient-to-br from-emerald-50/60 via-white to-amber-50/30 border-emerald-200/80 shadow-sm' 
                : 'bg-gradient-to-br from-emerald-950/20 via-slate-900/50 to-amber-950/10 border-emerald-500/20'
            }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800/80">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0 mt-0.5">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                      Official Meta Direct Integration
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                        Zero BSP Markups
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                      Signature Detailing communicates directly with Meta Cloud servers. You do not pay third-party platforms (WATI, Interakt, Aisensy) any monthly subscription fee (saving ₹36,000–₹60,000/year).
                    </p>
                  </div>
                </div>

                <div className={`px-4 py-3 rounded-xl border shrink-0 text-center ${
                  isLight ? 'bg-white border-emerald-200 shadow-sm' : 'bg-slate-950/60 border-emerald-500/30'
                }`}>
                  <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    Monthly Platform Fee
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                    ₹0.00
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Direct Developer Architecture</div>
                </div>
              </div>

              {/* Pricing breakdown grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                <div className={`p-4 rounded-xl border ${
                  isLight ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-slate-800'
                }`}>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span className="font-medium">Customer Inquiries</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold text-[10px]">FREE TIER</span>
                  </div>
                  <div className="text-xl font-bold text-emerald-500">
                    ₹0.00
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    First <strong>1,000 conversations / month</strong> are 100% free from Meta.
                  </div>
                </div>

                <div className={`p-4 rounded-xl border ${
                  isLight ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-slate-800'
                }`}>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span className="font-medium">Service (Beyond 1k)</span>
                    <span className="text-[10px] text-slate-400">If exceeded</span>
                  </div>
                  <div className="text-xl font-bold text-slate-800 dark:text-slate-200">
                    ~₹0.115 <span className="text-xs font-normal text-slate-400">/ msg</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    Only 11.5 paise in India if studio exceeds 1,000 monthly chats.
                  </div>
                </div>

                <div className={`p-4 rounded-xl border ${
                  isLight ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-slate-800'
                }`}>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span className="font-medium">Booking Alerts</span>
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-bold text-[10px]">UTILITY</span>
                  </div>
                  <div className="text-xl font-bold text-slate-800 dark:text-slate-200">
                    ~₹0.115 <span className="text-xs font-normal text-slate-400">/ msg</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    Automated appointment and delivery confirmation updates.
                  </div>
                </div>

                <div className={`p-4 rounded-xl border ${
                  isLight ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-slate-800'
                }`}>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span className="font-medium">Promo Broadcasts</span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-bold text-[10px]">MARKETING</span>
                  </div>
                  <div className="text-xl font-bold text-slate-800 dark:text-slate-200">
                    ~₹0.86 <span className="text-xs font-normal text-slate-400">/ msg</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    Festive offers & broadcast campaigns (only when sent by studio).
                  </div>
                </div>
              </div>

              <div className={`mt-5 p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                isLight ? 'bg-emerald-50/40 border-emerald-200/60 text-slate-700' : 'bg-slate-950/40 border-slate-800 text-slate-300'
              }`}>
                <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Pricing Transparency:</strong> Meta bills directly in Indian Rupees (~₹0.115 INR per utility message, which is 11.5 paise, <em>not</em> $0.15 USD). For Signature Detailing's expected 100–300 customer leads per month, everything operates entirely inside Meta's <strong>1,000 free conversations tier</strong>, resulting in <strong>₹0.00 monthly Meta invoice</strong>.
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
