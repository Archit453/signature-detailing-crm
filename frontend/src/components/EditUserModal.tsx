import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  Car,
  Shield,
  Check,
  Trash2,
  Clock,
  Calendar,
  Download,
  Star,
} from 'lucide-react';
import { InstagramIcon } from './Icons';
import type { Lead, LeadStatus, StudioService } from '../types';
import { api } from '../lib/api';
import { useTheme } from '../context/ThemeContext';

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  services: StudioService[];
  allLeads?: Lead[];
  onLeadUpdated: () => void;
  onDeleteLead?: (leadId: string) => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  isOpen,
  onClose,
  lead,
  services,
  allLeads = [],
  onLeadUpdated,
  onDeleteLead,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [activeTab, setActiveTab] = useState<'dossier' | 'history'>('dossier');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [instagramUsername, setInstagramUsername] = useState('');
  const [email, setEmail] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [status, setStatus] = useState<LeadStatus>('new');
  const [notes, setNotes] = useState('');

  // Vehicle info
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehicleRegNumber, setVehicleRegNumber] = useState('');
  const [paintCondition, setPaintCondition] = useState('Minor Swirls');
  const [inspectionNotes, setInspectionNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (lead) {
      setCustomerName(lead.customer?.name || '');
      setPhone(lead.customer?.phone || '');
      setInstagramUsername(lead.customer?.instagram_username || '');
      setEmail(lead.customer?.email || '');
      setServiceName(lead.service_name || '');
      setStatus(lead.status);
      setNotes(lead.notes || '');

      setVehicleMake(lead.vehicle?.make || '');
      setVehicleModel(lead.vehicle?.model || '');
      setVehicleYear(lead.vehicle?.year ? String(lead.vehicle.year) : '');
      setVehicleColor(lead.vehicle?.color || '');
      setVehicleRegNumber(lead.vehicle?.reg_number || '');
      setPaintCondition(lead.vehicle?.paint_condition || 'Minor Swirls');
      setInspectionNotes(lead.vehicle?.inspection_notes || '');
      setErrorMsg('');
      setActiveTab('dossier');
    }
  }, [lead]);

  const effectiveCustomerId = lead?.customer_id || lead?.customer?.id;
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isMarkingReview, setIsMarkingReview] = useState(false);

  const fetchActivities = async () => {
    if (!effectiveCustomerId) return;
    setIsLoadingActivities(true);
    try {
      const data = await api.getCustomerActivities(effectiveCustomerId);
      setActivities(data || []);
    } catch (e) {
      console.warn('Could not load customer activities:', e);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  useEffect(() => {
    if (effectiveCustomerId && activeTab === 'history') {
      fetchActivities();
    }
  }, [effectiveCustomerId, activeTab]);

  const handleMarkCustomerReviewed = async () => {
    if (!effectiveCustomerId) return;
    setIsMarkingReview(true);
    try {
      await api.addCustomerActivity(effectiveCustomerId, {
        type: 'customer_reviewed',
        title: '✓ Customer Reviewed ⭐⭐⭐⭐⭐',
        description: '5-Star Google review confirmed and verified by studio team.',
        channel: 'google',
      });
      await fetchActivities();
    } catch (err: any) {
      alert(`Could not log review: ${err.message}`);
    } finally {
      setIsMarkingReview(false);
    }
  };

  if (!isOpen || !lead) return null;

  // Filter history for this customer
  const customerHistory = allLeads.filter(
    (l) =>
      (lead.customer_id && l.customer_id === lead.customer_id) ||
      (lead.customer?.phone && l.customer?.phone === lead.customer?.phone)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setErrorMsg('Customer name is required');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await api.updateLead(lead.id, {
        customerName: customerName.trim(),
        phone: phone.trim(),
        instagramUsername: instagramUsername.trim().replace(/^@/, '') || null,
        email: email.trim() || null,
        serviceName,
        status,
        notes: notes.trim() || null,
        vehicleMake: vehicleMake.trim() || null,
        vehicleModel: vehicleModel.trim() || null,
        vehicleYear: vehicleYear.trim() ? parseInt(vehicleYear.trim(), 10) : null,
        vehicleColor: vehicleColor.trim() || null,
        vehicleRegNumber: vehicleRegNumber.trim() || null,
        paintCondition,
        inspectionNotes: inspectionNotes.trim() || null,
      });

      onLeadUpdated();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete lead for "${lead.customer?.name || 'Customer'}"?`)) {
      return;
    }
    try {
      await api.deleteLead(lead.id);
      if (onDeleteLead) onDeleteLead(lead.id);
      onLeadUpdated();
      onClose();
    } catch (err: any) {
      alert(`Failed to delete lead: ${err.message}`);
    }
  };

  const handleExportCustomerDossier = () => {
    if (!lead) return;

    const data = [
      '========================================================================',
      'SIGNATURE DETAILING STUDIO - OFFICIAL CUSTOMER & VEHICLE DOSSIER',
      '========================================================================',
      `Export Timestamp:    ${new Date().toLocaleString('en-IN')}`,
      `CRM Lead Record ID:  ${lead.id}`,
      '',
      '--- 1. CUSTOMER PROFILE ---',
      `Full Name:           ${customerName}`,
      `Phone Number:        ${phone || 'N/A'}`,
      `Email Address:       ${email || 'N/A'}`,
      `Instagram Handle:    ${instagramUsername || 'N/A'}`,
      `Inquiry Channel:     ${lead.source.toUpperCase()}`,
      `Created At:          ${lead.created_at ? new Date(lead.created_at).toLocaleString('en-IN') : 'N/A'}`,
      '',
      '--- 2. SERVICE & STUDIO WORKFLOW ---',
      `Service Package:     ${serviceName}`,
      `Current Status:      ${status.toUpperCase()}`,
      '',
      '--- 3. VEHICLE SPECIFICATIONS ---',
      `Vehicle Make:        ${vehicleMake || 'N/A'}`,
      `Vehicle Model:       ${vehicleModel || 'N/A'}`,
      `Model Year:          ${vehicleYear || 'N/A'}`,
      `Exterior Color:      ${vehicleColor || 'N/A'}`,
      `Registration Plate:  ${vehicleRegNumber || 'N/A'}`,
      `Paint Condition:     ${paintCondition || 'N/A'}`,
      `Studio Notes:        ${inspectionNotes || notes || 'None logged.'}`,
      '',
      '--- 4. SERVICE & INQUIRY HISTORY TIMELINE ---',
      ...(customerHistory.length > 0
        ? customerHistory.map((item, idx) => 
            `[Record #${idx + 1}] Service: ${item.service_name} | Stage: ${item.status.toUpperCase()} | Date: ${item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN') : 'Recent'} | Channel: ${item.source} ${item.notes ? `\n   Notes: ${item.notes}` : ''}`
          )
        : ['No previous service records logged in studio history.']),
      '========================================================================'
    ].join('\r\n');

    const blob = new Blob([data], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = (customerName || 'customer').toLowerCase().replace(/\s+/g, '-');
    link.href = url;
    link.setAttribute('download', `dossier-${safeName}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const inputClass = `w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none ${
    isLight
      ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#5E81F4] focus:ring-2 focus:ring-[#5E81F4]/10'
      : 'bg-[#16171A] border-white/[0.08] text-white placeholder-[#8E92A0] focus:border-[#5E81F4] focus:ring-2 focus:ring-[#5E81F4]/20'
  }`;

  const labelClass = `text-xs font-semibold block mb-1.5 ${isLight ? 'text-slate-700' : 'text-zinc-300'}`;
  const sectionHeaderClass = `text-[11px] font-bold uppercase tracking-wider block mb-3.5 ${isLight ? 'text-blue-600' : 'text-[#8E92A0]'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in overflow-y-auto font-sans">
      <div
        className={`relative w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col border transition-all ${
          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#1C1D21] border-[#282930] text-white'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isLight ? 'border-slate-200 bg-slate-50/90' : 'border-[#282930] bg-[#18191E]'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#5E81F4]/15 border border-[#5E81F4]/30 flex items-center justify-center text-[#5E81F4] shadow-sm">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-base font-bold leading-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Customer & Vehicle Dossier
              </h3>
              <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-[#8E92A0]'}`}>
                {lead.customer?.name || 'Customer'} •{' '}
                <span className="capitalize font-medium">{lead.source} inquiry</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Tab switcher */}
            <div className={`p-1 rounded-xl flex items-center space-x-1 border ${isLight ? 'bg-slate-200/70 border-slate-300' : 'bg-black/40 border-white/5'}`}>
              <button
                type="button"
                onClick={() => setActiveTab('dossier')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'dossier'
                    ? isLight
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'bg-[#5E81F4] text-white shadow-sm'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Dossier
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ${
                  activeTab === 'history'
                    ? isLight
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'bg-[#5E81F4] text-white shadow-sm'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>History ({customerHistory.length})</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900' : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {activeTab === 'dossier' ? (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/50 dark:border-red-500/30 dark:text-red-400 text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            {/* Section 1: Customer Contact Information */}
            <div>
              <span className={sectionHeaderClass}>1. Customer Details</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Customer Name *</label>
                  <div className="relative">
                    <User className={`w-4 h-4 absolute left-3.5 top-3 ${isLight ? 'text-slate-400' : 'text-[#8E92A0]'}`} />
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Rajesh Sharma"
                      className={`pl-10 ${inputClass}`}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Phone Number</label>
                  <div className="relative">
                    <Phone className={`w-4 h-4 absolute left-3.5 top-3 ${isLight ? 'text-slate-400' : 'text-[#8E92A0]'}`} />
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +91 98201 12345"
                      className={`pl-10 ${inputClass} font-mono`}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Instagram Username</label>
                  <div className="relative">
                    <div className={`w-4 h-4 absolute left-3.5 top-3 flex items-center justify-center ${isLight ? 'text-slate-400' : 'text-[#8E92A0]'}`}>
                      <InstagramIcon className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      value={instagramUsername}
                      onChange={(e) => setInstagramUsername(e.target.value)}
                      placeholder="e.g. client_handle"
                      className={`pl-10 ${inputClass}`}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Email Address</label>
                  <div className="relative">
                    <Mail className={`w-4 h-4 absolute left-3.5 top-3 ${isLight ? 'text-slate-400' : 'text-[#8E92A0]'}`} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. client@example.com"
                      className={`pl-10 ${inputClass}`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Service & Pipeline Status */}
            <div className={`pt-4 border-t ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
              <span className={sectionHeaderClass}>2. Service Package & Studio Stage</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Detailing Service Package</label>
                  <div className="relative">
                    <Shield className={`w-4 h-4 absolute left-3.5 top-3.5 ${isLight ? 'text-slate-400' : 'text-[#8E92A0]'}`} />
                    <select
                      value={serviceName}
                      onChange={(e) => setServiceName(e.target.value)}
                      className={`pl-10 ${inputClass} cursor-pointer`}
                    >
                      {services.map((s) => (
                        <option key={s.id} value={s.name} className={isLight ? 'bg-white text-slate-900' : 'bg-[#1C1D21] text-white'}>
                          {s.name}
                        </option>
                      ))}
                      {!services.some((s) => s.name === serviceName) && serviceName && (
                        <option value={serviceName} className={isLight ? 'bg-white text-slate-900' : 'bg-[#1C1D21] text-white'}>
                          {serviceName}
                        </option>
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Service Workflow Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as LeadStatus)}
                    className={`${inputClass} cursor-pointer font-semibold`}
                  >
                    <option value="new" className={isLight ? 'bg-white text-cyan-800' : 'bg-[#1C1D21] text-cyan-400'}>
                      New Inquiry / Requested
                    </option>
                    <option value="contacted" className={isLight ? 'bg-white text-purple-800' : 'bg-[#1C1D21] text-purple-400'}>
                      Contacted / Quote Sent
                    </option>
                    <option value="scheduled" className={isLight ? 'bg-white text-amber-800' : 'bg-[#1C1D21] text-amber-400'}>
                      Scheduled / Bay Reserved
                    </option>
                    <option value="in_progress" className={isLight ? 'bg-white text-blue-800' : 'bg-[#1C1D21] text-blue-400'}>
                      In Bay / Detailing In Progress
                    </option>
                    <option value="completed" className={isLight ? 'bg-white text-emerald-800' : 'bg-[#1C1D21] text-emerald-400'}>
                      Completed & Delivered
                    </option>
                    <option value="cancelled" className={isLight ? 'bg-white text-rose-800' : 'bg-[#1C1D21] text-red-400'}>
                      Cancelled / Lost
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 3: Vehicle Dossier */}
            <div className={`pt-4 border-t ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
              <span className={`${sectionHeaderClass} flex items-center space-x-1.5`}>
                <Car className="w-4 h-4 text-[#5E81F4]" />
                <span>3. Vehicle Dossier</span>
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className={labelClass}>Make</label>
                  <input
                    type="text"
                    value={vehicleMake}
                    onChange={(e) => setVehicleMake(e.target.value)}
                    placeholder="e.g. BMW"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Model</label>
                  <input
                    type="text"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder="e.g. 3 Series"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Year</label>
                  <input
                    type="number"
                    value={vehicleYear}
                    onChange={(e) => setVehicleYear(e.target.value)}
                    placeholder="2023"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Color</label>
                  <input
                    type="text"
                    value={vehicleColor}
                    onChange={(e) => setVehicleColor(e.target.value)}
                    placeholder="Portimao Blue"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Registration No.</label>
                  <input
                    type="text"
                    value={vehicleRegNumber}
                    onChange={(e) => setVehicleRegNumber(e.target.value)}
                    placeholder="OD 02 AB 1234"
                    className={`${inputClass} font-mono uppercase`}
                  />
                </div>

                <div>
                  <label className={labelClass}>Paint Condition</label>
                  <select
                    value={paintCondition}
                    onChange={(e) => setPaintCondition(e.target.value)}
                    className={`${inputClass} cursor-pointer`}
                  >
                    <option value="Factory New" className={isLight ? 'bg-white text-slate-800' : 'bg-[#1C1D21] text-white'}>Factory New</option>
                    <option value="Minor Swirls" className={isLight ? 'bg-white text-slate-800' : 'bg-[#1C1D21] text-white'}>Minor Swirls</option>
                    <option value="Heavy Oxidation" className={isLight ? 'bg-white text-slate-800' : 'bg-[#1C1D21] text-white'}>Heavy Oxidation</option>
                    <option value="Scratches/Dents" className={isLight ? 'bg-white text-slate-800' : 'bg-[#1C1D21] text-white'}>Scratches / Dents</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className={labelClass}>Studio Inspection & Vehicle Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Customer requested extra attention on bonnet swirl marks and rim ceramic coating..."
                  rows={3}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className={`flex items-center justify-between pt-4 border-t ${isLight ? 'border-slate-200' : 'border-[#282930]'}`}>
              <button
                type="button"
                onClick={handleDelete}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors border ${
                  isLight
                    ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-600'
                    : 'bg-red-950/20 hover:bg-red-950/40 border-red-500/25 text-red-400'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Dossier</span>
              </button>

              <div className="flex items-center space-x-2.5">
                <button
                  type="button"
                  onClick={handleExportCustomerDossier}
                  className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors border ${
                    isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' : 'bg-white/10 hover:bg-white/15 border-white/10 text-zinc-200'
                  }`}
                  title="Export customer & vehicle dossier"
                >
                  <Download className="w-3.5 h-3.5 text-blue-500" />
                  <span>Export Details</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-white/5 hover:bg-white/10 text-zinc-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-[#5E81F4] hover:bg-[#4E72EA] text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* Tab 2: Customer History & Activity */
          <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
            {/* 1. Post-Service & Review Timeline Section */}
            <div className={`p-4 rounded-2xl border ${isLight ? 'bg-slate-50/70 border-slate-200' : 'bg-[#16171A] border-white/5'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-800' : 'text-zinc-200'}`}>
                    Post-Service & Review Timeline
                  </h4>
                </div>
                {!activities.some((a) => a.type === 'customer_reviewed') && (
                  <button
                    type="button"
                    onClick={handleMarkCustomerReviewed}
                    disabled={isMarkingReview}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{isMarkingReview ? 'Marking...' : '+ Mark Customer Reviewed ⭐'}</span>
                  </button>
                )}
              </div>

              {isLoadingActivities ? (
                <div className={`p-4 text-center text-xs ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>
                  Loading timeline events...
                </div>
              ) : activities.length > 0 ? (
                <div className="space-y-2.5">
                  {activities.map((act, idx) => (
                    <div
                      key={act.id || idx}
                      className={`p-3 rounded-xl border flex items-start justify-between text-xs transition-all ${
                        act.type === 'customer_reviewed'
                          ? isLight
                            ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                            : 'bg-amber-950/25 border-amber-500/30 text-amber-200'
                          : act.type === 'review_request_sent'
                          ? isLight
                            ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                            : 'bg-blue-950/25 border-blue-500/30 text-blue-200'
                          : isLight
                          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                          : 'bg-emerald-950/25 border-emerald-500/30 text-emerald-200'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-xs">{act.title}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase font-semibold ${
                            act.type === 'customer_reviewed'
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                              : act.type === 'review_request_sent'
                              ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                              : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {act.channel || 'system'}
                          </span>
                        </div>
                        <p className="text-[11px] opacity-85 leading-relaxed">{act.description}</p>
                      </div>

                      <span className="text-[10px] opacity-60 shrink-0 ml-3 whitespace-nowrap">
                        {act.timestamp
                          ? new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : 'Logged'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`p-4 rounded-xl border border-dashed text-center text-xs ${
                  isLight ? 'border-slate-200 text-slate-500 bg-white/50' : 'border-white/10 text-zinc-400 bg-black/20'
                }`}>
                  <p className="font-medium">No review or completion timeline recorded yet.</p>
                  <p className="text-[11px] opacity-75 mt-0.5">
                    Completed services and review request dispatches are automatically logged here.
                  </p>
                </div>
              )}
            </div>

            {/* 2. Service Bookings & Inquiry Records */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
                  Service Bookings & Inquiry History
                </h4>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-zinc-300'}`}>
                  {customerHistory.length} records
                </span>
              </div>

              {customerHistory.length > 0 ? (
                <div className="space-y-3">
                  {customerHistory.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className={`p-4 rounded-2xl border transition-all ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#16171A] border-white/5'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className={`font-bold text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>
                              {item.service_name || 'Detailing Service'}
                            </span>
                            <span className={`text-[11px] px-2 py-0.5 rounded-md font-bold uppercase ${
                              item.status === 'completed'
                                ? isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-950/60 text-emerald-400'
                                : item.status === 'in_progress'
                                ? isLight ? 'bg-blue-100 text-blue-800' : 'bg-blue-950/60 text-blue-400'
                                : isLight ? 'bg-amber-100 text-amber-800' : 'bg-amber-950/60 text-amber-400'
                            }`}>
                              {item.status.replace('_', ' ')}
                            </span>
                          </div>

                          {item.vehicle && (
                            <p className={`text-xs flex items-center space-x-1.5 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                              <Car className="w-3.5 h-3.5 text-blue-500" />
                              <span>
                                {item.vehicle.make} {item.vehicle.model}{' '}
                                {item.vehicle.reg_number && `(${item.vehicle.reg_number})`}
                              </span>
                            </p>
                          )}
                        </div>

                        <div className="text-right">
                          <span className={`text-xs flex items-center space-x-1 ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>
                            <Calendar className="w-3 h-3" />
                            <span>
                              {item.created_at
                                ? new Date(item.created_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })
                                : 'Recent'}
                            </span>
                          </span>
                          <span className={`text-[10px] uppercase tracking-wider font-semibold ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>
                            via {item.source}
                          </span>
                        </div>
                      </div>

                      {item.notes && (
                        <div className={`mt-3 pt-2.5 border-t text-xs ${isLight ? 'border-slate-200 text-slate-600' : 'border-white/5 text-zinc-400'}`}>
                          <span className="font-semibold text-xs mr-1">Notes:</span>
                          {item.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`p-8 text-center rounded-2xl border border-dashed ${isLight ? 'border-slate-200 text-slate-500' : 'border-white/10 text-zinc-500'}`}>
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold">No previous service history found</p>
                  <p className="text-xs mt-1">This is the customer's first logged detailing service in the studio.</p>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className={`pt-4 flex items-center justify-between border-t ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
              <button
                type="button"
                onClick={handleExportCustomerDossier}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors border ${
                  isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' : 'bg-white/10 hover:bg-white/15 border-white/10 text-white'
                }`}
                title="Export complete customer profile, vehicles & service history"
              >
                <Download className="w-3.5 h-3.5 text-blue-500" />
                <span>Export Details</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-colors ${
                  isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-white/10 hover:bg-white/15 text-white'
                }`}
              >
                Close History
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

