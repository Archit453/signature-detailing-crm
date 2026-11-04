import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  ChevronDown,
  ChevronRight,
  Table as TableIcon,
  Kanban as KanbanIcon,
  Phone,
  Trash2,
  Edit3,
  Globe,
  Plus,
  MessageCircle,
  Download,
  Sparkles,
  RotateCw,
} from 'lucide-react';
import { InstagramIcon, WhatsAppIcon } from './Icons';
import type { Lead, LeadStatus, PipelineKPIs, StudioService } from '../types';
import { api } from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { EditUserModal } from './EditUserModal';
import { VehicleDossierSheet } from './VehicleDossierSheet';
import { ServiceCompletionModal } from './ServiceCompletionModal';

interface DashboardViewProps {
  onNavigateToChat?: (customerId: string, channel: 'whatsapp' | 'instagram') => void;
  onOpenQuickLead?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToChat,
  onOpenQuickLead,
}) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [kpis, setKpis] = useState<PipelineKPIs | null>(null);
  const [services, setServices] = useState<StudioService[]>([]);

  // Filtering and view state
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [activeKanbanStage, setActiveKanbanStage] = useState<LeadStatus>('new');

  // Modal states
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [dossierLead, setDossierLead] = useState<Lead | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [completingLead, setCompletingLead] = useState<Lead | null>(null);
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { theme } = useTheme();
  const isLight = theme === 'light';

  const fetchServicesOnce = async () => {
    try {
      const servicesData = await api.getServices();
      setServices(servicesData || []);
    } catch (err: any) {
      console.warn('Services fetch warning:', err.message);
    }
  };

  const fetchDashboardData = async () => {
    if (document.hidden) return;
    try {
      const [leadsData, kpisData] = await Promise.all([
        api.getLeads(),
        api.getPipelineKPIs(),
      ]);
      setLeads(leadsData || []);
      setKpis(kpisData || null);
    } catch (err: any) {
      console.warn('Dashboard data fetch warning:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await Promise.all([fetchDashboardData(), fetchServicesOnce()]);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  useEffect(() => {
    fetchServicesOnce();
    fetchDashboardData();

    const interval = setInterval(fetchDashboardData, 15000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchDashboardData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'f')) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Format exact time: "Sep 21, 10:30 AM"
  const formatExactTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Clean phone number formatter (+91 XXXXX XXXXX)
  const formatDisplayPhone = (rawPhone?: string | null) => {
    if (!rawPhone) return '—';
    let digits = String(rawPhone).replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) {
      digits = digits.slice(2);
    } else if (digits.startsWith('01') && digits.length === 12) {
      digits = digits.slice(2);
    } else if (digits.startsWith('0') && digits.length === 11) {
      digits = digits.slice(1);
    }
    if (digits.length === 10) {
      return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
    }
    return rawPhone;
  };

  // Get Initials for Avatar
  const getInitials = (name?: string) => {
    if (!name || name === 'Customer') return 'C';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Handle direct inline status update
  const handleStatusChange = async (leadId: string, newStatus: string) => {
    if (newStatus === 'completed') {
      const target = leads.find((l) => l.id === leadId);
      if (target) {
        setCompletingLead(target);
        setIsCompletionModalOpen(true);
        return;
      }
    }
    try {
      await api.updateLeadStatus(leadId, newStatus);
      fetchDashboardData();
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  // Kanban Stage Flow
  const stageFlow: Record<string, string> = {
    new: 'contacted',
    contacted: 'scheduled',
    scheduled: 'in_progress',
    in_progress: 'completed',
  };

  const getNextStatusLabel = (status: string) => {
    switch (status) {
      case 'new': return 'Contacted';
      case 'contacted': return 'Scheduled';
      case 'scheduled': return 'In Studio';
      case 'in_progress': return 'Delivered';
      default: return '';
    }
  };

  const handleAdvanceStatus = (lead: Lead) => {
    const next = stageFlow[lead.status];
    if (next) {
      handleStatusChange(lead.id, next);
    }
  };

  // Handle lead deletion
  const handleDeleteLead = async (leadId: string) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return;
    try {
      await api.deleteLead(leadId);
      fetchDashboardData();
    } catch (err: any) {
      alert(`Failed to delete lead: ${err.message}`);
    }
  };

  // Status Badge styling helper
  const getStatusBadgeClass = (status: string) => {
    if (isLight) {
      switch (status) {
        case 'new':
          return 'bg-cyan-50 text-cyan-800 border-cyan-300 font-bold';
        case 'contacted':
          return 'bg-purple-50 text-purple-800 border-purple-300 font-bold';
        case 'scheduled':
          return 'bg-amber-50 text-amber-900 border-amber-300 font-bold';
        case 'in_progress':
          return 'bg-blue-50 text-blue-900 border-blue-300 font-bold';
        case 'completed':
          return 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold';
        case 'cancelled':
          return 'bg-rose-50 text-rose-800 border-rose-300 font-bold';
        default:
          return 'bg-slate-100 text-slate-800 border-slate-300 font-semibold';
      }
    }
    switch (status) {
      case 'new':
        return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
      case 'contacted':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      case 'scheduled':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'in_progress':
        return 'bg-[#5E81F4]/20 text-[#CDD8FC] border-[#5E81F4]/40 font-semibold';
      case 'completed':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'cancelled':
        return 'bg-red-500/15 text-red-400 border-red-500/30';
      default:
        return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
    }
  };

  // Source Badge rendering helper
  const renderSourceBadge = (source: string) => {
    if (isLight) {
      switch (source) {
        case 'whatsapp':
          return (
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold tracking-wide shadow-xs">
              <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span>WHATSAPP</span>
            </span>
          );
        case 'instagram':
          return (
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-pink-50 text-pink-800 border border-pink-300 text-xs font-bold tracking-wide shadow-xs">
              <InstagramIcon className="w-3.5 h-3.5 text-pink-600" />
              <span>INSTAGRAM</span>
            </span>
          );
        case 'website':
          return (
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-300 text-xs font-bold tracking-wide shadow-xs">
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span>WEBSITE</span>
            </span>
          );
        default:
          return (
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold tracking-wide shadow-xs">
              <Phone className="w-3.5 h-3.5 text-slate-600" />
              <span className="capitalize">{source.replace('_', ' ')}</span>
            </span>
          );
      }
    }
    switch (source) {
      case 'whatsapp':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-bold tracking-wide">
            <WhatsAppIcon className="w-3.5 h-3.5" />
            <span>WHATSAPP</span>
          </span>
        );
      case 'instagram':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-pink-500/15 text-pink-400 border border-pink-500/30 text-xs font-bold tracking-wide">
            <InstagramIcon className="w-3.5 h-3.5" />
            <span>INSTAGRAM</span>
          </span>
        );
      case 'website':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 text-xs font-bold tracking-wide">
            <Globe className="w-3.5 h-3.5" />
            <span>WEBSITE</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-zinc-500/15 text-zinc-400 border border-zinc-500/30 text-xs font-semibold uppercase">
            <span>{source}</span>
          </span>
        );
    }
  };

  // Filtered leads calculation
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = lead.customer?.name?.toLowerCase().includes(q);
        const matchesPhone = lead.customer?.phone?.toLowerCase().includes(q);
        const matchesService = lead.service_name?.toLowerCase().includes(q);
        const matchesVehicle = `${lead.vehicle?.make || ''} ${lead.vehicle?.model || ''}`.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesService && !matchesVehicle) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all' && lead.status !== statusFilter) {
        return false;
      }

      // Service filter
      if (serviceFilter !== 'all' && lead.service_name !== serviceFilter) {
        return false;
      }

      // Source filter
      if (sourceFilter !== 'all' && lead.source !== sourceFilter) {
        return false;
      }

      return true;
    });
  }, [leads, searchQuery, statusFilter, serviceFilter, sourceFilter]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    statusFilter !== 'all' ||
    serviceFilter !== 'all' ||
    sourceFilter !== 'all'
  );

  // Export Filtered Leads & Vehicle Details to CSV
  const handleExportCSV = () => {
    if (!filteredLeads || filteredLeads.length === 0) {
      alert('No inquiries or customer records match your current filters to export.');
      return;
    }

    const headers = [
      'Lead ID',
      'Customer Name',
      'Phone Number',
      'Email Address',
      'Instagram Username',
      'Service Package',
      'Studio Workflow Status',
      'Inquiry Channel Source',
      'Vehicle Make',
      'Vehicle Model',
      'Vehicle Year',
      'Vehicle Color',
      'Registration Plate',
      'Paint Condition',
      'Studio Notes',
      'Inquiry Date & Time'
    ];

    const escapeCSV = (str: unknown) => {
      if (str === null || str === undefined) return '""';
      const val = String(str).replace(/"/g, '""');
      return `"${val}"`;
    };

    const rows = filteredLeads.map((lead) => {
      const v = lead.customer?.vehicles && lead.customer.vehicles.length > 0 ? lead.customer.vehicles[0] : null;
      return [
        escapeCSV(lead.id),
        escapeCSV(lead.customer?.name || ''),
        escapeCSV(lead.customer?.phone || ''),
        escapeCSV(lead.customer?.email || ''),
        escapeCSV(lead.customer?.instagram_username || ''),
        escapeCSV(lead.service_name || ''),
        escapeCSV(lead.status || ''),
        escapeCSV(lead.source || ''),
        escapeCSV(v?.make || ''),
        escapeCSV(v?.model || ''),
        escapeCSV(v?.year || ''),
        escapeCSV(v?.color || ''),
        escapeCSV(v?.reg_number || ''),
        escapeCSV(v?.paint_condition || ''),
        escapeCSV(lead.notes || lead.customer?.notes || v?.inspection_notes || ''),
        escapeCSV(lead.created_at ? new Date(lead.created_at).toLocaleString('en-IN') : '')
      ].join(',');
    });

    // UTF-8 BOM (\uFEFF) ensures Excel & spreadsheet tools handle special characters & Indian numbers properly
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = new Date().toISOString().split('T')[0];
    link.href = url;
    link.setAttribute('download', `signature-detailing-leads-${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`w-full px-3.5 sm:px-6 md:px-8 py-4 sm:py-6 space-y-5 md:space-y-6 pb-32 font-sans transition-colors duration-200 ${
      isLight ? 'bg-transparent text-slate-900' : 'bg-[#16171A] text-white'
    }`}>
      {/* Top Header & Context (Desktop only, mobile has TopBar) */}
      <div className={`hidden md:flex flex-row items-center justify-between gap-4 pb-3 border-b ${
        isLight ? 'border-slate-200/80' : 'border-[#26272E]'
      }`}>
        <div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}>
            Studio <span className="text-[#5E81F4]">Operations</span>
          </h1>
          <p className={`text-sm mt-1 font-normal ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
            Real-time lead tracking, studio operations & customer vehicle dossiers
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={handleManualRefresh}
            className={`p-2.5 rounded-xl border text-sm font-semibold transition-all active:scale-95 shadow-xs ${
              isLight
                ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900'
                : 'bg-[#1C1D21] hover:bg-white/10 border-white/[0.08] text-zinc-300 hover:text-white'
            }`}
            title="Refresh live leads & KPIs"
          >
            <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#5E81F4]' : 'text-slate-500'}`} />
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-xl border text-sm font-semibold transition-all active:scale-95 shadow-xs ${
              isLight
                ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900'
                : 'bg-[#1C1D21] hover:bg-white/10 border-white/[0.08] text-zinc-300 hover:text-white'
            }`}
            title="Export filtered inquiries & vehicle dossiers to CSV"
          >
            <Download className="w-4 h-4 text-blue-500" />
            <span>Export</span>
          </button>

          {onOpenQuickLead && (
            <button
              type="button"
              onClick={onOpenQuickLead}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#5E81F4] hover:bg-[#4E72EA] text-white font-semibold text-sm transition-all shadow-[0_4px_16px_rgba(94,129,244,0.3)] active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. STUDIO HERO OVERVIEW CARDS (Responsive: mobile carousel, desktop 3-col) */}
      {/* ========================================================================= */}
      <div className="flex md:grid md:grid-cols-3 gap-3.5 md:gap-5 w-full overflow-x-auto md:overflow-visible snap-x snap-mandatory no-scrollbar -mx-3.5 px-3.5 md:mx-0 md:px-0 pb-1 md:pb-0">
        {/* CARD 1: PRIMARY PIPELINE CARD */}
        <div className="w-[85vw] max-w-[340px] md:w-auto md:max-w-none shrink-0 md:shrink snap-center rounded-2xl p-5 bg-gradient-to-br from-[#5E81F4] via-[#5276EE] to-[#3B5FD9] text-white shadow-lg shadow-[#5E81F4]/20 relative overflow-hidden flex flex-col justify-between min-h-[175px]">
          <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/80">Active Detailing Pipeline</span>
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold backdrop-blur-sm">
                Live CRM
              </span>
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-black tracking-tight text-white">
                  {kpis?.counts?.total ?? leads.length}
                </span>
                <span className="text-sm font-semibold text-white/80">Total Inquiries</span>
              </div>
              <p className="text-xs font-medium text-white/90 mt-1">
                {kpis?.counts?.new ?? leads.filter((l) => l.status === 'new').length} new inquiries awaiting response
              </p>
            </div>
          </div>
          <div className="pt-3 border-t border-white/15 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1.5 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              <span>{(kpis?.counts?.scheduled || 0) + (kpis?.counts?.in_progress || 0)} In Studio / Scheduled</span>
            </div>
            <span className="text-white/80 text-[11px] font-mono">
              {kpis?.counts?.completed ?? leads.filter((l) => l.status === 'completed').length} Delivered
            </span>
          </div>
        </div>

        {/* CARD 2: CHANNEL BREAKDOWN (Clean Single Row) */}
        {(() => {
          const total = kpis?.counts?.total ?? leads.length;
          const waCount = kpis?.channelBreakdown?.whatsapp ?? leads.filter((l) => l.source === 'whatsapp').length;
          const igCount = kpis?.channelBreakdown?.instagram ?? leads.filter((l) => l.source === 'instagram').length;
          const directCount = total - (waCount + igCount) >= 0 ? total - (waCount + igCount) : 0;

          const waPct = total > 0 ? Math.round((waCount / total) * 100) : 0;
          const igPct = total > 0 ? Math.round((igCount / total) * 100) : 0;
          const directPct = total > 0 ? Math.round((directCount / total) * 100) : 0;

          return (
            <div className={`w-[85vw] max-w-[340px] md:w-auto md:max-w-none shrink-0 md:shrink snap-center rounded-2xl p-5 flex flex-col justify-between min-h-[175px] border transition-all ${
              isLight ? 'bg-white border-slate-200/90 shadow-sm text-slate-900' : 'bg-[#1C1D21] border-white/[0.08] shadow-md text-white'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                    Lead Ingestion Channels
                  </span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${
                    isLight ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-[#5E81F4]/15 border-[#5E81F4]/30 text-[#CDD8FC]'
                  }`}>
                    Auto-Capture
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {/* WhatsApp */}
                  <div className={`p-2.5 rounded-xl border text-center ${
                    isLight ? 'bg-emerald-50/50 border-emerald-200/60' : 'bg-emerald-950/20 border-emerald-500/20'
                  }`}>
                    <span className="text-[11px] font-bold text-emerald-600 block">WhatsApp</span>
                    <span className={`text-lg font-black mt-0.5 block ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      {waCount}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold">{waPct}% share</span>
                  </div>

                  {/* Instagram */}
                  <div className={`p-2.5 rounded-xl border text-center ${
                    isLight ? 'bg-pink-50/50 border-pink-200/60' : 'bg-pink-950/20 border-pink-500/20'
                  }`}>
                    <span className="text-[11px] font-bold text-pink-600 block">Instagram</span>
                    <span className={`text-lg font-black mt-0.5 block ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      {igCount}
                    </span>
                    <span className="text-[10px] text-pink-600 font-bold">{igPct}% share</span>
                  </div>

                  {/* Web / Direct */}
                  <div className={`p-2.5 rounded-xl border text-center ${
                    isLight ? 'bg-blue-50/50 border-blue-200/60' : 'bg-blue-950/20 border-blue-500/20'
                  }`}>
                    <span className="text-[11px] font-bold text-blue-600 block">Direct / Web</span>
                    <span className={`text-lg font-black mt-0.5 block ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      {directCount}
                    </span>
                    <span className="text-[10px] text-blue-600 font-bold">{directPct}% share</span>
                  </div>
                </div>
              </div>

              <div className={`pt-2.5 border-t flex items-center justify-between text-[11px] ${
                isLight ? 'border-slate-100 text-slate-500' : 'border-white/[0.04] text-zinc-400'
              }`}>
                <span>Synced via Webhook APIs</span>
                <span className="font-semibold text-emerald-500">● 100% Online</span>
              </div>
            </div>
          );
        })()}

        {/* CARD 3: CONVERSION RATE */}
        {(() => {
          const totalLeads = leads.length;
          const bookedLeads = leads.filter(
            (l) => l.status === 'scheduled' || l.status === 'in_progress' || l.status === 'completed'
          ).length;
          const conversionRate = totalLeads > 0 ? Math.round((bookedLeads / totalLeads) * 100) : 0;

          return (
            <div className={`w-[85vw] max-w-[340px] md:w-auto md:max-w-none shrink-0 md:shrink snap-center rounded-2xl p-5 flex flex-col justify-between min-h-[175px] border transition-all ${
              isLight ? 'bg-white border-slate-200/90 shadow-sm text-slate-900' : 'bg-[#1C1D21] border-white/[0.08] shadow-md text-white'
            }`}>
              <div>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                    Conversion Rate
                  </span>
                  <span className="text-2xl font-black text-[#5E81F4]">
                    {conversionRate}%
                  </span>
                </div>

                <div className="mt-3.5">
                  <div className={`w-full h-2.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/10'}`}>
                    <div
                      className="h-full bg-gradient-to-r from-[#5E81F4] to-[#8FA7F8] rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(Math.max(conversionRate, 4), 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs mt-2">
                    <span className={isLight ? 'text-slate-600 font-medium' : 'text-zinc-300 font-medium'}>
                      {bookedLeads} of {totalLeads} inquiries converted
                    </span>
                    <span className={`font-semibold ${conversionRate >= 50 ? 'text-emerald-500' : 'text-[#5E81F4]'}`}>
                      {conversionRate >= 50 ? 'Target Exceeded' : 'Active Flow'}
                    </span>
                  </div>
                </div>
              </div>

              <div className={`flex items-center justify-between text-[11px] pt-2 border-t ${
                isLight ? 'border-slate-100 text-slate-500' : 'border-white/[0.04] text-zinc-400'
              }`}>
                <span>Average Response Time</span>
                <span className="font-semibold text-emerald-500">&lt; 3 mins</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Mobile Swipe Indicators */}
      <div className="md:hidden flex items-center justify-center space-x-1.5 pt-0.5">
        <span className="w-4 h-1 rounded-full bg-[#5E81F4]" />
        <span className={`w-1.5 h-1 rounded-full ${isLight ? 'bg-slate-300' : 'bg-zinc-700'}`} />
        <span className={`w-1.5 h-1 rounded-full ${isLight ? 'bg-slate-300' : 'bg-zinc-700'}`} />
      </div>

      {/* ========================================================================= */}
      {/* 2. SEARCH & MULTI-FILTER BAR                                              */}
      {/* ========================================================================= */}
      <div className={`p-4 rounded-2xl space-y-3 transition-all border ${
        isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-[#1C1D21] border-white/[0.08] shadow-md'
      }`}>
        {/* Top search input */}
        <div className="relative w-full">
          <Search className={`w-4 h-4 absolute left-4 top-3.5 ${isLight ? 'text-slate-400' : 'text-[#8E92A0]'}`} />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer, phone, car model, or service..."
            className={`w-full pl-11 pr-20 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:border-[#5E81F4] ${
              isLight
                ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                : 'bg-[#16171A] border-white/[0.08] text-white placeholder:text-zinc-500'
            }`}
          />
          <div className={`hidden sm:block absolute right-3.5 top-2.5 px-2 py-1 rounded-md border text-[11px] font-mono ${
            isLight ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-[#222328] border-white/[0.06] text-[#8E92A0]'
          }`}>
            Ctrl + K
          </div>
        </div>

        {/* Bottom filters and view mode toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Dropdown filters */}
          <div className="grid grid-cols-3 gap-2 w-full sm:flex sm:w-auto">
            {/* Status Dropdown */}
            <div className="relative w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`w-full appearance-none pl-3 pr-7 py-2 rounded-xl border text-xs font-medium focus:outline-none focus:border-[#5E81F4] cursor-pointer transition-colors ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                    : 'bg-[#16171A] border-white/[0.08] text-zinc-300 hover:border-white/20'
                }`}
              >
                <option value="all">Status: All</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Studio</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <ChevronDown className={`w-3.5 h-3.5 absolute right-2 top-2.5 pointer-events-none ${isLight ? 'text-slate-500' : 'text-[#8E92A0]'}`} />
            </div>

            {/* Service Dropdown */}
            <div className="relative w-full sm:w-auto">
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className={`w-full appearance-none pl-3 pr-7 py-2 rounded-xl border text-xs font-medium focus:outline-none focus:border-[#5E81F4] cursor-pointer transition-colors ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                    : 'bg-[#16171A] border-white/[0.08] text-zinc-300 hover:border-white/20'
                }`}
              >
                <option value="all">Service: All</option>
                {Array.from(new Set(leads.map((l) => l.service_name))).map((srv) => (
                  <option key={srv} value={srv}>
                    {srv}
                  </option>
                ))}
              </select>
              <ChevronDown className={`w-3.5 h-3.5 absolute right-2 top-2.5 pointer-events-none ${isLight ? 'text-slate-500' : 'text-[#8E92A0]'}`} />
            </div>

            {/* Channel / Source Dropdown */}
            <div className="relative w-full sm:w-auto">
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className={`w-full appearance-none pl-3 pr-7 py-2 rounded-xl border text-xs font-medium focus:outline-none focus:border-[#5E81F4] cursor-pointer transition-colors ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                    : 'bg-[#16171A] border-white/[0.08] text-zinc-300 hover:border-white/20'
                }`}
              >
                <option value="all">Source: All</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
                <option value="website">Website</option>
                <option value="walk_in">Walk-in</option>
                <option value="phone">Phone Call</option>
              </select>
              <ChevronDown className={`w-3.5 h-3.5 absolute right-2 top-2.5 pointer-events-none ${isLight ? 'text-slate-500' : 'text-[#8E92A0]'}`} />
            </div>
          </div>

          {/* Right: View Mode Toggle Only */}
          <div className={`flex items-center gap-1 p-1 rounded-xl border self-end sm:self-auto ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#16171A] border-white/[0.06]'
          }`}>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'table'
                  ? isLight ? 'bg-white text-[#5E81F4] shadow-xs font-bold' : 'bg-[#5E81F4] text-white shadow-sm font-bold'
                  : isLight ? 'text-slate-500 hover:text-slate-900' : 'text-[#8E92A0] hover:text-white'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>

            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'kanban'
                  ? isLight ? 'bg-white text-[#5E81F4] shadow-xs font-bold' : 'bg-[#5E81F4] text-white shadow-sm font-bold'
                  : isLight ? 'text-slate-500 hover:text-slate-900' : 'text-[#8E92A0] hover:text-white'
              }`}
            >
              <KanbanIcon className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. TABLE / MOBILE CARDS VIEW                                              */}
      {/* ========================================================================= */}
      {viewMode === 'table' && (
        <>
          {/* MOBILE LEAD CARD LIST (< md screens: High-Touch Mobile First Cards) */}
          <div className="md:hidden space-y-3">
            {isLoading ? (
              <div className={`p-8 text-center rounded-2xl ${isLight ? 'bg-white border-slate-200 text-slate-600 shadow-sm' : 'bg-[#1C1D21] border-white/[0.08] text-[#8E92A0]'} border flex flex-col items-center justify-center space-y-3 py-12`}>
                <RotateCw className="w-6 h-6 text-[#5E81F4] animate-spin" />
                <span className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>Loading live inquiries...</span>
              </div>
            ) : filteredLeads.length > 0 ? (
              filteredLeads.map((lead) => {
                const initials = getInitials(lead.customer?.name);
                const firstVehicle = lead.customer?.vehicles && lead.customer.vehicles.length > 0
                  ? lead.customer.vehicles[0]
                  : null;
                const cleanPhone = (lead.customer?.phone || '').replace(/\D/g, '');

                return (
                  <div
                    key={lead.id}
                    className={`p-4 rounded-2xl ${isLight ? 'bg-white border-slate-200 shadow-sm active:border-blue-400' : 'bg-[#1C1D21] border-white/[0.08] shadow-md active:border-[#5E81F4]/40'} border space-y-3 transition-all`}
                  >
                    {/* Top Row: Initials Avatar + Name + Inquiry Time + Source Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#5E81F4] to-[#CDD8FC] text-[#16171A] font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <button
                            onClick={() => {
                              setEditingLead(lead);
                              setIsEditModalOpen(true);
                            }}
                            className={`font-bold text-base ${isLight ? 'text-slate-900 hover:text-blue-600' : 'text-white hover:text-[#5E81F4]'} transition-colors text-left truncate block`}
                          >
                            {lead.customer?.name || 'Customer'}
                          </button>
                          <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-400'} block mt-0.5`}>
                            {formatExactTime(lead.created_at)}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {renderSourceBadge(lead.source)}
                      </div>
                    </div>

                    {/* Middle Row: Vehicle & Service Pill */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {firstVehicle && (
                        <span className={`text-xs font-semibold ${isLight ? 'text-blue-800 bg-blue-50 border-blue-200' : 'text-[#CDD8FC] bg-[#5E81F4]/15 border-[#5E81F4]/20'} px-2.5 py-1 rounded-lg inline-flex items-center space-x-1.5 border`}>
                          <span>🚗</span>
                          <span>{firstVehicle.make} {firstVehicle.model}</span>
                          {firstVehicle.reg_number && (
                            <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>({firstVehicle.reg_number})</span>
                          )}
                        </span>
                      )}

                      <span className={`text-xs font-medium ${isLight ? 'text-slate-700 bg-slate-100 border-slate-200' : 'text-zinc-200 bg-[#16171A] border-white/10'} px-2.5 py-1 rounded-lg border`}>
                        {lead.service_name}
                      </span>
                    </div>

                    {/* Bottom Row: Inline Status Selector + Quick Action Buttons */}
                    <div className={`flex items-center justify-between pt-2 border-t ${isLight ? 'border-slate-100' : 'border-white/[0.06]'} gap-2`}>
                      {/* Status Dropdown */}
                      <div className="relative">
                        <select
                          value={lead.status}
                          onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                          className={`appearance-none pl-3 pr-7 py-1.5 rounded-xl text-xs font-semibold border focus:outline-none cursor-pointer transition-colors ${getStatusBadgeClass(
                            lead.status
                          )}`}
                        >
                          <option value="new" className={isLight ? 'bg-white text-cyan-800 font-bold' : 'bg-[#1C1D21] text-cyan-400'}>New</option>
                          <option value="contacted" className={isLight ? 'bg-white text-purple-800 font-bold' : 'bg-[#1C1D21] text-purple-400'}>Contacted</option>
                          <option value="scheduled" className={isLight ? 'bg-white text-amber-900 font-bold' : 'bg-[#1C1D21] text-amber-400'}>Scheduled</option>
                          <option value="in_progress" className={isLight ? 'bg-white text-blue-900 font-bold' : 'bg-[#1C1D21] text-blue-400'}>In Studio</option>
                          <option value="completed" className={isLight ? 'bg-white text-emerald-800 font-bold' : 'bg-[#1C1D21] text-emerald-400'}>Completed</option>
                          <option value="cancelled" className={isLight ? 'bg-white text-rose-800 font-bold' : 'bg-[#1C1D21] text-red-400'}>Cancelled</option>
                        </select>
                        <ChevronDown className={`w-3.5 h-3.5 absolute right-2 top-2.5 ${isLight ? 'text-slate-500' : 'text-[#8E92A0]'} pointer-events-none`} />
                      </div>

                      {/* Quick Action Buttons */}
                      <div className="flex items-center space-x-1.5">
                        {/* Call */}
                        {lead.customer?.phone && (
                          <a
                            href={`tel:${lead.customer.phone}`}
                            className={`w-9 h-9 rounded-xl ${isLight ? 'bg-slate-100 hover:bg-blue-50 hover:text-blue-600 border-slate-200 text-slate-700' : 'bg-white/[0.04] hover:bg-[#5E81F4]/20 hover:text-[#5E81F4] border-white/[0.06] text-zinc-300'} border flex items-center justify-center transition-colors`}
                            title="Call Customer"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}

                        {/* WhatsApp Direct */}
                        {cleanPhone && (
                          <a
                            href={`https://wa.me/${cleanPhone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`w-9 h-9 rounded-xl ${isLight ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-600 shadow-xs' : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-400'} border flex items-center justify-center transition-colors`}
                            title="Chat on WhatsApp"
                          >
                            <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                          </a>
                        )}

                        {/* CRM Chat */}
                        <button
                          onClick={() => {
                            if (onNavigateToChat && lead.customer_id) {
                              onNavigateToChat(
                                lead.customer_id,
                                lead.source === 'instagram' ? 'instagram' : 'whatsapp'
                              );
                            }
                          }}
                          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl ${isLight ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800 font-bold shadow-xs' : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-400 font-semibold'} border text-xs transition-all`}
                          title="Open Live Chat"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Chat</span>
                        </button>

                        {/* Edit User Dossier */}
                        <button
                          onClick={() => {
                            setEditingLead(lead);
                            setIsEditModalOpen(true);
                          }}
                          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl ${isLight ? 'bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-800 font-bold shadow-xs' : 'bg-[#5E81F4]/15 hover:bg-[#5E81F4]/25 border-[#5E81F4]/30 text-[#CDD8FC] font-semibold'} border text-xs transition-all`}
                          title="Edit Customer Profile & Vehicle Specs"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        {/* Delete Lead */}
                        <button
                          onClick={() => handleDeleteLead(lead.id)}
                          className={`w-9 h-9 rounded-xl ${isLight ? 'bg-slate-100 hover:bg-rose-50 hover:text-rose-600 border-slate-200 text-slate-600' : 'bg-white/[0.04] hover:bg-red-500/20 hover:text-red-400 border-white/[0.06] text-[#8E92A0]'} border flex items-center justify-center transition-colors`}
                          title="Delete Lead"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (leads.length === 0 && !hasActiveFilters) ? (
              <div className={`p-8 text-center rounded-3xl ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#1C1D21] border-white/[0.08]'} border flex flex-col items-center justify-center space-y-3 py-12`}>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#5E81F4]/20 to-[#CDD8FC]/20 text-[#5E81F4] flex items-center justify-center shadow-inner">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  No inquiries in your pipeline yet
                </h3>
                <p className={`text-xs max-w-xs ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                  Start booking car detailing jobs or capturing leads automatically from WhatsApp and Instagram.
                </p>
                {onOpenQuickLead && (
                  <button
                    onClick={onOpenQuickLead}
                    className="mt-2 inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#5E81F4] hover:bg-[#4d6fd9] text-white text-xs font-bold shadow-md shadow-[#5E81F4]/25 transition-all active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add First Lead</span>
                  </button>
                )}
              </div>
            ) : (
              <div className={`p-8 text-center rounded-2xl ${isLight ? 'bg-white border-slate-200 text-slate-600 shadow-sm' : 'bg-[#1C1D21] border-white/[0.08] text-[#8E92A0]'} border`}>



                <p className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                  No inquiries match your current filters.
                </p>
                <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>
                  Try clearing your search query or reset status/channel filters.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setServiceFilter('all');
                    setSourceFilter('all');
                  }}
                  className="mt-3 inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-[#5E81F4]/10 hover:bg-[#5E81F4]/20 text-[#5E81F4] text-xs font-bold transition-colors"
                >
                  <span>Reset all filters</span>
                </button>
              </div>
            )}
          </div>

          {/* DESKTOP HIGH-DENSITY TABLE (>= md screens) */}
          <div className={`hidden md:block rounded-3xl ${isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-[#1C1D21] border-white/[0.08] shadow-2xl'} border overflow-hidden`}>
            {/* Table Meta Bar with Lead Count and Scroll Note */}
            <div className={`px-6 py-3.5 border-b flex items-center justify-between ${
              isLight ? 'bg-slate-50/70 border-slate-200' : 'bg-[#18191E]/70 border-[#26272E]'
            }`}>
              <div className="flex items-center space-x-2.5">
                <span className={`text-xs font-bold uppercase tracking-wider ${
                  isLight ? 'text-slate-700' : 'text-zinc-300'
                }`}>
                  Inquiries Pipeline
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isLight ? 'bg-blue-50 text-[#5E81F4] border border-blue-200' : 'bg-[#5E81F4]/20 text-[#CDD8FC] border border-[#5E81F4]/30'
                }`}>
                  {filteredLeads.length} {filteredLeads.length === 1 ? 'Lead' : 'Leads'}
                </span>
              </div>
              <span className={`text-xs font-medium flex items-center space-x-1.5 ${
                isLight ? 'text-slate-400' : 'text-zinc-500'
              }`}>
                <span>↕ Scroll table inside to view all inquiries</span>
              </span>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[700px] custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[960px]">
                <thead className="sticky top-0 z-10 shadow-xs">
                  <tr className={`border-b ${isLight ? 'border-slate-200 bg-slate-100/95 backdrop-blur-md text-slate-700' : 'border-[#26272E] bg-[#18191E]/95 backdrop-blur-md text-zinc-300'} text-xs font-bold uppercase tracking-wider`}>
                    <th className="py-4 px-5 w-[24%]">Customer & Vehicle</th>
                    <th className="py-4 px-5 w-[14%]">Phone</th>
                    <th className="py-4 px-5 w-[15%]">Service</th>
                    <th className="py-4 px-5 w-[12%]">Source</th>
                    <th className="py-4 px-5 w-[12%]">Status</th>
                    <th className="py-4 px-5 w-[8%]">Inquiry</th>
                    <th className="py-4 px-5 text-right w-[15%]">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-white/[0.04]'}`}>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className={`py-14 text-center ${isLight ? 'text-slate-500' : 'text-[#8E92A0]'}`}>
                        <div className="flex flex-col items-center justify-center space-y-2.5">
                          <RotateCw className="w-6 h-6 text-[#5E81F4] animate-spin" />
                          <span className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>Loading live inquiries...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredLeads.length > 0 ? (
                    filteredLeads.map((lead) => {
                      const initials = getInitials(lead.customer?.name);
                      const cleanPhone = (lead.customer?.phone || '').replace(/\D/g, '');
                      const firstVehicle = lead.customer?.vehicles && lead.customer.vehicles.length > 0
                        ? lead.customer.vehicles[0]
                        : null;

                      return (
                        <tr
                          key={lead.id}
                          onClick={() => {
                            setEditingLead(lead);
                            setIsEditModalOpen(true);
                          }}
                          className={`${isLight ? 'hover:bg-slate-50/90' : 'hover:bg-white/[0.04]'} transition-colors group cursor-pointer`}
                        >
                          {/* CUSTOMER & VEHICLE */}
                          <td className="py-4 px-5">
                            <div className="flex items-center space-x-3.5">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#5E81F4] to-[#CDD8FC] text-[#16171A] font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <span
                                  className={`font-bold text-sm ${isLight ? 'text-slate-900 group-hover:text-blue-600' : 'text-white group-hover:text-[#5E81F4]'} transition-colors block text-left truncate`}
                                >
                                  {lead.customer?.name || 'Customer'}
                                </span>

                                {/* Prominently visible vehicle info */}
                                <div className="flex items-center space-x-1.5 mt-0.5">
                                  {firstVehicle ? (
                                    <span className={`text-xs font-semibold ${isLight ? 'text-blue-800 bg-blue-50 border-blue-200' : 'text-[#CDD8FC] bg-[#5E81F4]/15 border-[#5E81F4]/20'} px-2 py-0.5 rounded-md inline-flex items-center space-x-1 border`}>
                                      <span>🚗</span>
                                      <span>{firstVehicle.make} {firstVehicle.model}</span>
                                      {firstVehicle.reg_number && (
                                        <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>({firstVehicle.reg_number})</span>
                                      )}
                                    </span>
                                  ) : (
                                    <span className={`text-xs font-mono ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>
                                      ID: {lead.id.slice(0, 8)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* PHONE NUMBER */}
                          <td className={`py-4 px-5 text-sm font-medium ${isLight ? 'text-slate-700' : 'text-zinc-300'} whitespace-nowrap`}>
                            {lead.customer?.phone ? (
                              <a
                                href={`tel:${lead.customer.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className={`${isLight ? 'text-slate-800 hover:text-blue-600' : 'text-zinc-300 hover:text-[#5E81F4]'} transition-colors font-mono`}
                              >
                                {formatDisplayPhone(lead.customer.phone)}
                              </a>
                            ) : (
                              <span className={isLight ? 'text-slate-400' : 'text-[#8E92A0]'}>—</span>
                            )}
                          </td>

                          {/* REQUESTED SERVICE */}
                          <td className="py-4 px-5">
                            <div className="flex flex-wrap gap-1.5 max-w-[280px]">
                              {(lead.service_name || '').split(',').map((srv, sIdx) => (
                                <span
                                  key={sIdx}
                                  className={`inline-block px-2.5 py-1 rounded-lg ${isLight ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-[#16171A] border-white/10 text-zinc-200'} border text-xs font-semibold`}
                                >
                                  {srv.trim()}
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* SOURCE */}
                          <td className="py-4 px-5 whitespace-nowrap">
                            {renderSourceBadge(lead.source)}
                          </td>

                          {/* STATUS (Dropdown) */}
                          <td className="py-4 px-5 whitespace-nowrap">
                            <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                              <select
                                value={lead.status}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(lead.id, e.target.value);
                                }}
                                className={`appearance-none pl-3 pr-8 py-1.5 rounded-xl text-xs font-semibold border focus:outline-none cursor-pointer transition-colors ${getStatusBadgeClass(
                                  lead.status
                                )}`}
                              >
                                <option value="new" className={isLight ? 'bg-white text-cyan-800 font-bold' : 'bg-[#1C1D21] text-cyan-400'}>
                                  New
                                </option>
                                <option value="contacted" className={isLight ? 'bg-white text-purple-800 font-bold' : 'bg-[#1C1D21] text-purple-400'}>
                                  Contacted
                                </option>
                                <option value="scheduled" className={isLight ? 'bg-white text-amber-900 font-bold' : 'bg-[#1C1D21] text-amber-400'}>
                                  Scheduled
                                </option>
                                <option value="in_progress" className={isLight ? 'bg-white text-blue-900 font-bold' : 'bg-[#1C1D21] text-blue-400'}>
                                  In Studio
                                </option>
                                <option value="completed" className={isLight ? 'bg-white text-emerald-800 font-bold' : 'bg-[#1C1D21] text-emerald-400'}>
                                  Completed
                                </option>
                                <option value="cancelled" className={isLight ? 'bg-white text-rose-800 font-bold' : 'bg-[#1C1D21] text-red-400'}>
                                  Cancelled
                                </option>
                              </select>
                              <ChevronDown className={`w-3.5 h-3.5 absolute right-2.5 top-2.5 ${isLight ? 'text-slate-500' : 'text-[#8E92A0]'} pointer-events-none`} />
                            </div>
                          </td>

                          {/* INQUIRY DATE */}
                          <td className={`py-4 px-5 text-xs ${isLight ? 'text-slate-500' : 'text-zinc-400'} whitespace-nowrap`}>
                            {formatExactTime(lead.created_at)}
                          </td>

                          {/* ACTIONS */}
                          <td className="py-4 px-5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end space-x-1.5" onClick={(e) => e.stopPropagation()}>
                              {/* CRM Chat Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onNavigateToChat && lead.customer_id) {
                                    onNavigateToChat(
                                      lead.customer_id,
                                      lead.source === 'instagram' ? 'instagram' : 'whatsapp'
                                    );
                                  }
                                }}
                                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl ${isLight ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800 font-bold shadow-xs' : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-400 font-semibold shadow-sm'} border text-xs transition-all active:scale-95`}
                                title="Open Live Chat in Unified Inbox"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>Chat</span>
                              </button>

                              {/* EDIT USER BUTTON */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingLead(lead);
                                  setIsEditModalOpen(true);
                                }}
                                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl ${isLight ? 'bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-800 font-bold shadow-xs' : 'bg-[#5E81F4]/15 hover:bg-[#5E81F4]/25 border-[#5E81F4]/30 text-[#CDD8FC] font-semibold'} border text-xs transition-all active:scale-95`}
                                title="Edit Customer Profile & Vehicle Specs"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>

                              {/* WhatsApp Direct Link */}
                              {cleanPhone && (
                                <a
                                  href={`https://wa.me/${cleanPhone}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className={`w-8 h-8 rounded-xl ${
                                    isLight
                                      ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-600 shadow-xs'
                                      : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-400'
                                  } border flex items-center justify-center transition-all active:scale-95`}
                                  title="Chat on WhatsApp"
                                >
                                  <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                                </a>
                              )}

                              {/* Phone Call Link */}
                              {lead.customer?.phone && (
                                <a
                                  href={`tel:${lead.customer.phone}`}
                                  className={`w-8 h-8 rounded-xl ${isLight ? 'bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border-slate-200 text-slate-600' : 'bg-white/[0.04] hover:bg-[#5E81F4]/20 hover:text-[#5E81F4] border-white/[0.06] hover:border-[#5E81F4]/30 text-[#8E92A0]'} border flex items-center justify-center transition-colors`}
                                  title="Call Client"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                </a>
                              )}

                              {/* Delete Lead Button */}
                              <button
                                onClick={() => handleDeleteLead(lead.id)}
                                className={`w-8 h-8 rounded-xl ${isLight ? 'bg-slate-100 hover:bg-rose-50 hover:text-rose-700 border-slate-200 text-slate-600' : 'bg-white/[0.04] hover:bg-red-500/20 hover:text-red-400 border-white/[0.06] hover:border-red-500/30 text-[#8E92A0]'} border flex items-center justify-center transition-colors`}
                                title="Delete Lead"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (leads.length === 0 && !hasActiveFilters) ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center space-y-3 max-w-md mx-auto">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#5E81F4]/20 to-[#CDD8FC]/20 text-[#5E81F4] flex items-center justify-center shadow-inner">
                            <Sparkles className="w-7 h-7" />
                          </div>
                          <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                            No inquiries in your pipeline yet
                          </h3>
                          <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                            Your booking pipeline is ready. Add your first customer inquiry manually or connect WhatsApp/Instagram to receive leads in real time.
                          </p>
                          {onOpenQuickLead && (
                            <button
                              onClick={onOpenQuickLead}
                              className="mt-2 inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#5E81F4] hover:bg-[#4d6fd9] text-white text-xs font-bold shadow-lg shadow-[#5E81F4]/25 transition-all active:scale-95"
                            >
                              <Plus className="w-4 h-4" />
                              <span>Add First Lead</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={7} className={`py-14 text-center ${isLight ? 'text-slate-500' : 'text-[#8E92A0]'}`}>
        
        
        
                        <p className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                          No inquiries match your current filters.
                        </p>
                        <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>
                          Try clearing your search query or reset status/channel filters.
                        </p>
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setStatusFilter('all');
                            setServiceFilter('all');
                            setSourceFilter('all');
                          }}
                          className="mt-3 inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#5E81F4]/10 hover:bg-[#5E81F4]/20 text-[#5E81F4] text-xs font-bold transition-colors"
                        >
                          <span>Reset all filters</span>
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Bottom Footer: Showing count and quick shortcut */}
            {filteredLeads.length > 0 && (
              <div className={`px-6 py-3 border-t flex items-center justify-between text-xs ${
                isLight ? 'bg-slate-50/70 border-slate-200 text-slate-500' : 'bg-[#18191E]/70 border-[#26272E] text-zinc-400'
              }`}>
                <span>Showing <strong className={isLight ? 'text-slate-800' : 'text-white'}>{filteredLeads.length}</strong> of {leads.length} total inquiries</span>
                <span className="text-[11px] opacity-75">Click any row to view customer dossier</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* 4. KANBAN PIPELINE VIEW (When toggled to Kanban)                          */}
      {/* ========================================================================= */}
      {viewMode === 'kanban' && (
        <>
          {/* MOBILE KANBAN: Stage Switcher Tabs (< md) */}
          <div className="md:hidden space-y-4">
            {/* Stage Switcher Pills */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
              {[
                { id: 'new' as const, label: 'New Inquiries', color: 'text-cyan-400' },
                { id: 'contacted' as const, label: 'Contacted', color: 'text-purple-400' },
                { id: 'scheduled' as const, label: 'Scheduled', color: 'text-amber-400' },
                { id: 'in_progress' as const, label: 'In Studio', color: 'text-[#5E81F4]' },
                { id: 'completed' as const, label: 'Delivered', color: 'text-emerald-400' },
              ].map((col) => {
                const count = filteredLeads.filter((l) => l.status === col.id).length;
                const isActive = activeKanbanStage === col.id;
                return (
                  <button
                    key={col.id}
                    onClick={() => setActiveKanbanStage(col.id)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-[#5E81F4] text-white shadow-md shadow-[rgba(94,129,244,0.3)] font-bold'
                        : isLight
                        ? 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm'
                        : 'bg-[#1C1D21] border border-white/[0.06] text-[#8E92A0] hover:text-white'
                    }`}
                  >
                    <span className={isActive ? 'text-white' : col.color}>{col.label}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : isLight
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-[#16171A] text-[#8E92A0]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Stage Leads Card List */}
            <div className="space-y-3">
              {filteredLeads.filter((l) => l.status === activeKanbanStage).length > 0 ? (
                filteredLeads
                  .filter((l) => l.status === activeKanbanStage)
                  .map((lead) => {
                    const initials = getInitials(lead.customer?.name);
                    const firstVehicle =
                      lead.customer?.vehicles && lead.customer.vehicles.length > 0
                        ? lead.customer.vehicles[0]
                        : null;

                    return (
                      <div
                        key={lead.id}
                        onClick={() => {
                          setEditingLead(lead);
                          setIsEditModalOpen(true);
                        }}
                        className={`p-4 rounded-2xl border shadow-md space-y-3 cursor-pointer transition-all ${
                          isLight
                            ? 'bg-white border-slate-200 hover:border-blue-400 shadow-sm'
                            : 'bg-[#1C1D21] border-white/[0.08] hover:border-[#5E81F4]/40'
                        }`}
                        title="Click card to view dossier & history"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#5E81F4] to-[#CDD8FC] text-[#16171A] font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <span className={`font-extrabold text-sm block truncate ${isLight ? 'text-blue-700' : 'text-[#CDD8FC]'}`}>
                                {lead.service_name}
                              </span>
                              <span className={`font-bold text-xs block truncate mt-0.5 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                {lead.customer?.name || 'Customer'}
                              </span>
                              <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-zinc-400'} block mt-0.5`}>
                                {formatExactTime(lead.created_at)}
                              </span>
                            </div>
                          </div>
                          <div className="shrink-0">{renderSourceBadge(lead.source)}</div>
                        </div>

                        {/* Vehicle & Service */}
                        {firstVehicle && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg inline-flex items-center space-x-1.5 border ${
                              isLight
                                ? 'bg-slate-100 text-slate-700 border-slate-200'
                                : 'text-[#CDD8FC] bg-[#5E81F4]/15 border-[#5E81F4]/20'
                            }`}>
                              <span>🚗</span>
                              <span>
                                {firstVehicle.make} {firstVehicle.model}
                              </span>
                              {firstVehicle.reg_number && (
                                <span className={isLight ? 'text-slate-500 text-[11px]' : 'text-zinc-400 text-[11px]'}>
                                  ({firstVehicle.reg_number})
                                </span>
                              )}
                            </span>
                          </div>
                        )}

                        {/* Status & Actions */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className={`flex items-center justify-between pt-2 border-t ${isLight ? 'border-slate-100' : 'border-white/[0.06]'} gap-2`}
                        >
                          <div className="relative">
                            <select
                              value={lead.status}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleStatusChange(lead.id, e.target.value);
                              }}
                              className={`appearance-none pl-3 pr-7 py-1.5 rounded-xl text-xs font-semibold border focus:outline-none cursor-pointer transition-colors ${getStatusBadgeClass(
                                lead.status
                              )}`}
                            >
                              <option value="new" className={isLight ? 'bg-white text-cyan-800 font-bold' : 'bg-[#1C1D21] text-cyan-400'}>
                                New
                              </option>
                              <option value="contacted" className={isLight ? 'bg-white text-purple-800 font-bold' : 'bg-[#1C1D21] text-purple-400'}>
                                Contacted
                              </option>
                              <option value="scheduled" className={isLight ? 'bg-white text-amber-900 font-bold' : 'bg-[#1C1D21] text-amber-400'}>
                                Scheduled
                              </option>
                              <option value="in_progress" className={isLight ? 'bg-white text-blue-900 font-bold' : 'bg-[#1C1D21] text-blue-400'}>
                                In Studio
                              </option>
                              <option value="completed" className={isLight ? 'bg-white text-emerald-800 font-bold' : 'bg-[#1C1D21] text-emerald-400'}>
                                Completed
                              </option>
                              <option value="cancelled" className={isLight ? 'bg-white text-rose-800 font-bold' : 'bg-[#1C1D21] text-red-400'}>
                                Cancelled
                              </option>
                            </select>
                            <ChevronDown className={`w-3.5 h-3.5 absolute right-2 top-2.5 ${isLight ? 'text-slate-500' : 'text-[#8E92A0]'} pointer-events-none`} />
                          </div>

                          <div className="flex items-center space-x-1.5">
                            {lead.customer?.phone && (
                              <a
                                href={`tel:${lead.customer.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className={`w-9 h-9 rounded-xl ${
                                  isLight ? 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 border-slate-200' : 'bg-white/[0.04] hover:bg-[#5E81F4]/20 hover:text-[#5E81F4] border-white/[0.06] text-zinc-300'
                                } border flex items-center justify-center transition-colors`}
                                title="Call Customer"
                              >
                                <Phone className="w-4 h-4" />
                              </a>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onNavigateToChat && lead.customer_id) {
                                  onNavigateToChat(
                                    lead.customer_id,
                                    lead.source === 'instagram' ? 'instagram' : 'whatsapp'
                                  );
                                }
                              }}
                              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-semibold transition-all"
                              title="Open Live Chat"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Chat</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLead(lead.id);
                              }}
                              className={`w-9 h-9 rounded-xl ${isLight ? 'bg-slate-100 hover:bg-red-50 hover:text-red-600 border-slate-200 text-slate-500' : 'bg-white/[0.04] hover:bg-red-500/20 hover:text-red-400 border-white/[0.06] text-[#8E92A0]'} border flex items-center justify-center transition-colors`}
                              title="Delete Lead"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className={`h-44 flex flex-col items-center justify-center text-sm ${isLight ? 'border-slate-300 bg-white/70 text-slate-600' : 'border-white/[0.08] bg-[#1C1D21]/50 text-[#8E92A0]'} border border-dashed rounded-2xl p-6`}>
                  <p className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white/90'} mb-1`}>No inquiries in this stage</p>
                  <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>Use the tabs above to view other pipeline stages.</p>
                </div>
              )}
            </div>
          </div>

          {/* DESKTOP KANBAN: 5-Column Grid (>= md) with horizontal scroll container to prevent squeezing */}
          <div className="hidden md:block overflow-x-auto custom-scrollbar pb-4 -mx-1 px-1">
            <div className="grid grid-cols-5 gap-5 min-w-[1280px]">
              {[
                { id: 'new', label: 'New Inquiries', color: 'text-cyan-400 border-cyan-500/40' },
                { id: 'contacted', label: 'Contacted', color: 'text-purple-400 border-purple-500/40' },
                { id: 'scheduled', label: 'Scheduled', color: 'text-amber-400 border-amber-500/40' },
                { id: 'in_progress', label: 'In Studio', color: 'text-[#5E81F4] border-[#5E81F4]/40' },
                { id: 'completed', label: 'Delivered', color: 'text-emerald-400 border-emerald-500/40' },
              ].map((col) => {
                const colLeads = filteredLeads.filter((l) => l.status === col.id);
                return (
                  <div
                    key={col.id}
                    className={`p-4 rounded-3xl ${isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-[#1C1D21] border-white/[0.08]'} border flex flex-col space-y-3.5 h-[700px]`}
                  >
                    <div className={`flex items-center justify-between pb-3 border-b shrink-0 ${isLight ? 'border-slate-200' : 'border-[#26272E]'}`}>
                      <span className={`text-xs font-bold uppercase tracking-wider ${col.color}`}>
                        {col.label}
                      </span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full ${isLight ? 'bg-white text-slate-700 border border-slate-200' : 'bg-[#16171A] text-zinc-300'} font-mono font-bold`}>
                        {colLeads.length}
                      </span>
                    </div>

                    <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-0">
                      {colLeads.map((lead) => {
                        const firstVehicle =
                          lead.customer?.vehicles && lead.customer.vehicles.length > 0
                            ? lead.customer.vehicles[0]
                            : null;

                        return (
                          <div
                            key={lead.id}
                            onClick={() => {
                              setEditingLead(lead);
                              setIsEditModalOpen(true);
                            }}
                            className={`p-4 rounded-2xl ${
                              isLight
                                ? 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-md'
                                : 'bg-[#16171A] border-white/[0.06] hover:border-[#5E81F4]/40 hover:shadow-lg hover:shadow-black/20'
                            } border transition-all space-y-3 group cursor-pointer`}
                            title="Click to view full dossier & history"
                          >
                            {/* Card Top: Service Package & Channel Badge */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-1.5">
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-blue-600' : 'text-[#5E81F4]'}`}>
                                  ✨ Service Package
                                </span>
                                {renderSourceBadge(lead.source)}
                              </div>
                              <p className={`text-sm font-extrabold line-clamp-2 ${isLight ? 'text-slate-900' : 'text-white'} leading-snug`} title={lead.service_name}>
                                {lead.service_name}
                              </p>
                            </div>

                            {/* Customer & Vehicle Information */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className={`font-semibold text-xs ${isLight ? 'text-slate-900' : 'text-white'} truncate`}>
                                  👤 {lead.customer?.name || 'Walk-in Customer'}
                                </span>
                                {lead.customer?.phone && (
                                  <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-zinc-400'} font-mono`}>
                                    {formatDisplayPhone(lead.customer.phone)}
                                  </span>
                                )}
                              </div>

                              {firstVehicle && (
                                <div className={`text-xs font-semibold ${
                                  isLight ? 'text-blue-900 bg-blue-50/80 border-blue-200' : 'text-[#CDD8FC] bg-[#5E81F4]/15 border-[#5E81F4]/20'
                                } px-2.5 py-1 rounded-lg inline-flex items-center space-x-1.5 border max-w-full truncate`}>
                                  <span>🚗</span>
                                  <span className="truncate">
                                    {firstVehicle.make} {firstVehicle.model}
                                  </span>
                                  {firstVehicle.reg_number && (
                                    <span className={`text-[10px] font-mono ${isLight ? 'text-blue-600' : 'text-[#8E92A0]'}`}>
                                      ({firstVehicle.reg_number})
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Status Movement / Service Stage Control */}
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className={`flex items-center justify-between gap-1.5 pt-2.5 border-t ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}
                            >
                              {/* Inline Status Dropdown */}
                              <div className="relative flex-1 min-w-0">
                                <select
                                  value={lead.status}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleStatusChange(lead.id, e.target.value);
                                  }}
                                  className={`w-full appearance-none pl-2.5 pr-6 py-1.5 rounded-xl text-xs font-bold border focus:outline-none cursor-pointer transition-all ${getStatusBadgeClass(
                                    lead.status
                                  )}`}
                                  title="Change Service Stage"
                                >
                                  <option value="new" className={isLight ? 'bg-white text-cyan-800 font-bold' : 'bg-[#1C1D21] text-cyan-400'}>New</option>
                                  <option value="contacted" className={isLight ? 'bg-white text-purple-800 font-bold' : 'bg-[#1C1D21] text-purple-400'}>Contacted</option>
                                  <option value="scheduled" className={isLight ? 'bg-white text-amber-900 font-bold' : 'bg-[#1C1D21] text-amber-400'}>Scheduled</option>
                                  <option value="in_progress" className={isLight ? 'bg-white text-blue-900 font-bold' : 'bg-[#1C1D21] text-blue-400'}>In Studio</option>
                                  <option value="completed" className={isLight ? 'bg-white text-emerald-800 font-bold' : 'bg-[#1C1D21] text-emerald-400'}>Delivered</option>
                                  <option value="cancelled" className={isLight ? 'bg-white text-rose-800 font-bold' : 'bg-[#1C1D21] text-red-400'}>Cancelled</option>
                                </select>
                                <ChevronDown className={`w-3.5 h-3.5 absolute right-2 top-2.5 pointer-events-none ${isLight ? 'text-slate-500' : 'text-[#8E92A0]'}`} />
                              </div>

                              {/* Quick Advance Button */}
                              {lead.status !== 'completed' && lead.status !== 'cancelled' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAdvanceStatus(lead);
                                  }}
                                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center space-x-0.5 shrink-0 active:scale-95 ${
                                    isLight
                                      ? 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-800 shadow-xs'
                                      : 'bg-[#5E81F4]/20 hover:bg-[#5E81F4]/30 border-[#5E81F4]/30 text-[#CDD8FC]'
                                  }`}
                                  title={`Advance to ${getNextStatusLabel(lead.status)}`}
                                >
                                  <span>Move</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {/* Card Footer: Timestamp & Quick Action Buttons */}
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className={`flex items-center justify-between pt-2 border-t ${isLight ? 'border-slate-100' : 'border-white/[0.05]'} text-xs`}
                            >
                              <span className={`text-[11px] ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>
                                {formatExactTime(lead.created_at)}
                              </span>
                              <div className="flex items-center space-x-1.5">
                                {lead.customer?.phone && (
                                  <>
                                    <a
                                      href={`https://wa.me/${lead.customer.phone.replace(/\D/g, '')}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className={`p-1.5 rounded-lg ${isLight ? 'hover:bg-emerald-50 text-emerald-600' : 'hover:bg-emerald-500/10 text-emerald-400'} transition-colors`}
                                      title="Chat on WhatsApp"
                                    >
                                      <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366]" />
                                    </a>
                                    <a
                                      href={`tel:${lead.customer.phone}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className={`p-1.5 rounded-lg ${isLight ? 'hover:bg-slate-100 text-slate-500 hover:text-blue-600' : 'hover:bg-white/10 text-[#8E92A0] hover:text-[#5E81F4]'} transition-colors`}
                                      title="Call Customer"
                                    >
                                      <Phone className="w-3.5 h-3.5" />
                                    </a>
                                  </>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onNavigateToChat && lead.customer_id) {
                                      onNavigateToChat(
                                        lead.customer_id,
                                        lead.source === 'instagram' ? 'instagram' : 'whatsapp'
                                      );
                                    }
                                  }}
                                  className={`p-1.5 rounded-lg ${isLight ? 'hover:bg-slate-100 text-slate-500 hover:text-emerald-600' : 'hover:bg-white/10 text-[#8E92A0] hover:text-emerald-400'} transition-colors`}
                                  title="Open CRM Chat"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteLead(lead.id);
                                  }}
                                  className={`p-1.5 rounded-lg ${isLight ? 'hover:bg-red-50 text-slate-400 hover:text-red-500' : 'hover:bg-white/10 text-[#8E92A0] hover:text-red-400'} transition-colors`}
                                  title="Delete Lead"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {colLeads.length === 0 && (
                        <div className={`h-36 flex items-center justify-center text-xs ${isLight ? 'text-slate-400 border-slate-300' : 'text-zinc-500 border-white/[0.06]'} border border-dashed rounded-2xl`}>
                          Empty stage
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* 5. MODALS: Edit User Modal & Vehicle Dossier Sheet */}
      {/* ========================================================================= */}
      <EditUserModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingLead(null);
        }}
        lead={editingLead}
        allLeads={leads}
        services={services}
        onLeadUpdated={fetchDashboardData}
        onDeleteLead={fetchDashboardData}
      />

      <VehicleDossierSheet
        isOpen={isDossierOpen}
        onClose={() => {
          setIsDossierOpen(false);
          setDossierLead(null);
        }}
        customer={dossierLead?.customer || null}
        activeLeadStatus={dossierLead?.status || 'new'}
        leadId={dossierLead?.id}
        onLeadStatusUpdated={fetchDashboardData}
        onVehicleAdded={fetchDashboardData}
      />

      {/* Service Delivery & Review Request Flow Modal */}
      <ServiceCompletionModal
        isOpen={isCompletionModalOpen}
        lead={completingLead}
        onClose={() => {
          setIsCompletionModalOpen(false);
          setCompletingLead(null);
        }}
        onConfirmCompletion={async (id) => {
          await api.updateLeadStatus(id, 'completed');
          await fetchDashboardData();
        }}
        onFinished={() => {
          setIsCompletionModalOpen(false);
          setCompletingLead(null);
          fetchDashboardData();
        }}
      />
    </div>
  );
};
