import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Globe, 
  Settings2,
  MessageSquare,
  Sun,
  Moon,
  Copy,
  Check,
  FileCode2,
  BadgeCheck,
  ShieldCheck,
  Info
} from 'lucide-react';
import { InstagramIcon } from './Icons';

export const SettingsView: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const isLight = theme === 'light';
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const CopyButton = ({ id, text }: { id: string; text: string }) => (
    <button
      onClick={() => handleCopy(id, text)}
      className={`p-1.5 rounded-md transition-colors ${
        isLight 
          ? 'text-slate-400 hover:text-amber-500 hover:bg-amber-50' 
          : 'text-slate-500 hover:text-amber-400 hover:bg-amber-500/10'
      }`}
      title="Copy to clipboard"
    >
      {copiedKey === id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
    </button>
  );

  return (
    <div className={`p-6 max-w-5xl mx-auto font-sans min-h-screen transition-colors duration-200 ${
      isLight ? 'text-slate-900' : 'text-slate-100'
    }`}>
      {/* Top Header */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Settings2 className="w-6 h-6 text-amber-500" />
            <h1 className="text-2xl font-bold tracking-tight">Settings & Studio Guide</h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Studio configuration, Meta WhatsApp transparency, and integration endpoints.
          </p>
        </div>
        
        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(isLight ? 'dark' : 'light')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold text-sm transition-all ${
            isLight
              ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
              : 'bg-slate-900/50 border-slate-800 text-slate-300 hover:bg-slate-800'
          }`}
        >
          {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
          <span>{isLight ? 'Dark Mode' : 'Light Mode'}</span>
        </button>
      </div>

      <div className="mt-8 space-y-8">

        {/* WhatsApp Meta Official Pricing & Transparency Card */}
        <section>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4 px-1 flex items-center justify-between">
            <span>Meta WhatsApp Cloud API Direct Pricing & Free Tier</span>
            <span className="flex items-center gap-1 text-emerald-500 normal-case font-medium">
              <BadgeCheck className="w-3.5 h-3.5" /> 100% Direct Meta Cloud API (No Middlemen)
            </span>
          </div>

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
              {/* Tier 1: Service / Customer Inquiries */}
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

              {/* Tier 2: Customer Care window */}
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

              {/* Tier 3: Utility / Bookings */}
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

              {/* Tier 4: Marketing campaigns */}
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

            {/* Clarity Note */}
            <div className={`mt-5 p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
              isLight ? 'bg-emerald-50/40 border-emerald-200/60 text-slate-700' : 'bg-slate-950/40 border-slate-800 text-slate-300'
            }`}>
              <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Pricing Transparency:</strong> Meta bills directly in Indian Rupees (~₹0.115 INR per utility message, which is 11.5 paise, <em>not</em> $0.15 USD). For Signature Detailing's expected 100–300 customer leads per month, everything operates entirely inside Meta's <strong>1,000 free conversations tier</strong>, resulting in <strong>₹0.00 monthly Meta invoice</strong>.
              </div>
            </div>
          </div>
        </section>

        {/* Studio Profile Overview */}
        <section>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4 px-1">
            Studio Profile & Verified Details
          </div>
          
          <div className={`rounded-2xl border overflow-hidden ${
            isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/50 border-slate-800'
          }`}>
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="p-5 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 font-medium mb-0.5">Studio Name</div>
                    <div className="font-semibold text-sm">Signature Detailing</div>
                  </div>
                </div>
              </div>
              
              <div className="p-5 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 shrink-0">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 font-medium mb-0.5">Website URL</div>
                    <div className="font-semibold text-sm text-emerald-500">signature-detailing.pages.dev</div>
                  </div>
                </div>
              </div>
              
              <div className="p-5 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 shrink-0">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 font-medium mb-0.5">Contact Phone & WhatsApp</div>
                    <div className="font-semibold text-sm">+91 98612 01770</div>
                  </div>
                </div>
              </div>
              
              <div className="p-5 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-slate-400 font-medium mb-0.5">Google Review Link</div>
                    <div className="font-semibold text-sm leading-snug truncate" title="https://search.google.com/local/writereview?placeid=ChIJey82fSsLGToRc9YiRRlQJ2Q">
                      https://search.google.com/local/writereview?placeid=ChIJey82fSsLGToRc9YiRRlQJ2Q
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-5 md:col-span-2">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500 shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 font-medium mb-0.5">Studio Physical Address</div>
                    <div className="font-semibold text-sm">Plot no - 55, Pahala, Before Utkal Mahindra Service, Bhubaneswar, Odisha 752101</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Configuration Guide (Single Source of Truth) */}
        <section>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4 px-1">
            Studio Configuration & Settings File
          </div>
          
          <div className={`p-5 rounded-2xl border ${
            isLight ? 'bg-amber-50/50 border-amber-200 text-slate-800 shadow-sm' : 'bg-amber-500/10 border-amber-500/20 text-slate-200'
          }`}>
            <div className="flex items-start gap-3">
              <FileCode2 className="w-6 h-6 text-amber-500 shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-base mb-1.5">Single Source of Truth</h3>
                <p className="text-sm opacity-90 leading-relaxed mb-3">
                  All studio details, phone numbers, Google Maps location links, and review response templates are centralized in the backend configuration.
                </p>
                <div className="p-3 rounded-lg bg-black/10 dark:bg-black/30 border border-black/5 dark:border-white/5 font-mono text-sm inline-block">
                  backend/src/config/studio.config.js
                </div>
                <p className="text-xs mt-3 opacity-70">
                  Any changes saved to this file take effect instantly across all chatbot replies, notification alerts, and automated review requests.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Integration Webhooks Guide */}
        <section>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4 px-1">
            Live Webhook Endpoints
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* WhatsApp Integration */}
            <div className={`p-5 rounded-2xl border ${
              isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/50 border-slate-800'
            }`}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#25D366]/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4 text-[#25D366]" />
                </div>
                <h3 className="font-bold text-[#25D366]">WhatsApp Cloud API</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-slate-500 font-medium mb-1">Callback URL (Webhook)</div>
                  <div className={`flex items-center justify-between p-3 rounded-lg border ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-slate-800'
                  }`}>
                    <code className="text-[11px] truncate text-slate-600 dark:text-slate-400 select-all">
                      https://signaturedetailing-five.vercel.app/api/webhooks/whatsapp
                    </code>
                    <CopyButton id="wa-url" text="https://signaturedetailing-five.vercel.app/api/webhooks/whatsapp" />
                  </div>
                </div>
                
                <div>
                  <div className="text-xs text-slate-500 font-medium mb-1">Verify Token</div>
                  <div className={`flex items-center justify-between p-3 rounded-lg border ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-slate-800'
                  }`}>
                    <code className="text-xs font-semibold text-slate-700 dark:text-slate-300 select-all">
                      signature_wa_verify_secret
                    </code>
                    <CopyButton id="wa-token" text="signature_wa_verify_secret" />
                  </div>
                </div>
              </div>
            </div>

            {/* Instagram Integration */}
            <div className={`p-5 rounded-2xl border ${
              isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/50 border-slate-800'
            }`}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center shrink-0">
                  <InstagramIcon className="w-4 h-4 text-pink-500" />
                </div>
                <h3 className="font-bold text-pink-500">Instagram Graph API</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-slate-500 font-medium mb-1">Callback URL (Webhook)</div>
                  <div className={`flex items-center justify-between p-3 rounded-lg border ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-slate-800'
                  }`}>
                    <code className="text-[11px] truncate text-slate-600 dark:text-slate-400 select-all">
                      https://signaturedetailing-five.vercel.app/api/webhooks/instagram
                    </code>
                    <CopyButton id="ig-url" text="https://signaturedetailing-five.vercel.app/api/webhooks/instagram" />
                  </div>
                </div>
                
                <div>
                  <div className="text-xs text-slate-500 font-medium mb-1">Verify Token</div>
                  <div className={`flex items-center justify-between p-3 rounded-lg border ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-slate-800'
                  }`}>
                    <code className="text-xs font-semibold text-slate-700 dark:text-slate-300 select-all">
                      signature_ig_verify_secret
                    </code>
                    <CopyButton id="ig-token" text="signature_ig_verify_secret" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};
