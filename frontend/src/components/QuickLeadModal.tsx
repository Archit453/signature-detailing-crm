import React, { useState, useEffect, useRef } from 'react';
import { X, Search, User, Phone, Car, Shield, Check, Plus, UserPlus } from 'lucide-react';
import { api } from '../lib/api';
import type { StudioService } from '../types';
import { useTheme } from '../context/ThemeContext';
import { formatDisplayPhone } from '../lib/formatters';

interface QuickLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  services: StudioService[];
  onLeadCreated: () => void;
}

export const QuickLeadModal: React.FC<QuickLeadModalProps> = ({
  isOpen,
  onClose,
  services,
  onLeadCreated,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Customer search & selection
  const [searchQuery, setSearchQuery] = useState('');
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');

  // Mode: 'existing' | 'new'
  const [mode, setMode] = useState<'search' | 'new_customer'>('search');

  // New Customer Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('');

  // Service Booking Fields
  const [service, setService] = useState('');
  const [status, setStatus] = useState('new');
  const [source, setSource] = useState('walk_in');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch customers on open or search query change
  useEffect(() => {
    if (isOpen) {
      setIsSearching(true);
      api.getCustomers(searchQuery)
        .then((data) => setCustomerList(data || []))
        .catch(() => setCustomerList([]))
        .finally(() => setIsSearching(false));
    }
  }, [isOpen, searchQuery]);

  // Reset state strictly when modal is newly opened
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setSearchQuery('');
      setSelectedCustomer(null);
      setSelectedVehicleId('');
      setMode('search');
      setName('');
      setPhone('');
      setVehicle('');
      setService(services[0]?.name || '');
      setStatus('new');
      setSource('walk_in');
      setNotes('');
      setErrorMsg('');
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, services]);

  // Set default service when services load if not yet chosen
  useEffect(() => {
    if (!service && services.length > 0) {
      setService(services[0].name);
    }
  }, [services, service]);

  if (!isOpen) return null;

  const handleSelectCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    if (customer.vehicles && customer.vehicles.length > 0) {
      setSelectedVehicleId(customer.vehicles[0].id);
    } else {
      setSelectedVehicleId('');
    }
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!service) {
      setErrorMsg('Please select a detailing service package');
      return;
    }

    if (!selectedCustomer && mode === 'search') {
      setErrorMsg('Please select an existing customer or switch to "+ New Customer"');
      return;
    }

    if (mode === 'new_customer') {
      if (!name.trim() || !phone.trim()) {
        setErrorMsg('Customer name and phone number are required');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      if (selectedCustomer) {
        // Link with existing customer
        await api.createWebsiteLead({
          customerId: selectedCustomer.id,
          vehicleId: selectedVehicleId || undefined,
          vehicle: !selectedVehicleId && vehicle.trim() ? vehicle.trim() : undefined,
          service,
          status,
          source,
          notes: notes.trim() || undefined,
        });
      } else {
        // Create with new customer details
        await api.createWebsiteLead({
          name: name.trim(),
          phone: phone.trim(),
          vehicle: vehicle.trim() || undefined,
          service,
          status,
          source,
          notes: notes.trim() || undefined,
        });
      }

      onLeadCreated();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add service booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = `w-full px-3.5 py-2.5 rounded-xl border text-xs transition-all focus:outline-none ${
    isLight
      ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#5E81F4] focus:ring-2 focus:ring-[#5E81F4]/10'
      : 'bg-[#16171A] border-white/[0.08] text-white placeholder-[#8E92A0] focus:border-[#5E81F4] focus:ring-2 focus:ring-[#5E81F4]/20'
  }`;

  const labelClass = `text-[11px] font-bold uppercase tracking-wider block mb-1.5 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in overflow-y-auto font-sans">
      <div
        className={`relative w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col border transition-all ${
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
            <div className="w-9 h-9 rounded-2xl bg-[#5E81F4]/15 border border-[#5E81F4]/30 flex items-center justify-center text-[#5E81F4] shadow-sm">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-base font-bold leading-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Add Service Booking
              </h3>
              <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-[#8E92A0]'}`}>
                Search existing client or create a new client & assign service
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
              isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900' : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/50 dark:border-red-500/30 dark:text-red-400 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Customer Selection or Creation Mode Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelClass}>1. Client Details</label>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setMode('search');
                    setSelectedCustomer(null);
                  }}
                  className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    mode === 'search'
                      ? isLight ? 'bg-blue-100 text-blue-700' : 'bg-[#5E81F4]/20 text-[#CDD8FC]'
                      : isLight ? 'text-slate-500 hover:text-slate-800' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Search Client
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('new_customer');
                    setSelectedCustomer(null);
                  }}
                  className={`text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center space-x-1 transition-all ${
                    mode === 'new_customer'
                      ? isLight ? 'bg-blue-100 text-blue-700' : 'bg-[#5E81F4]/20 text-[#CDD8FC]'
                      : isLight ? 'text-slate-500 hover:text-slate-800' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ New Client</span>
                </button>
              </div>
            </div>

            {mode === 'search' ? (
              <div className="space-y-2.5">
                {selectedCustomer ? (
                  /* Selected Customer Banner */
                  <div
                    className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                      isLight ? 'bg-emerald-50/80 border-emerald-200' : 'bg-emerald-950/20 border-emerald-500/30'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <Check className="w-4 h-4" />
                      </div>
                      <div>
                        <span className={`font-bold text-xs block ${isLight ? 'text-slate-900' : 'text-white'}`}>
                          {selectedCustomer.name}
                        </span>
                        <span className={`text-[11px] font-mono ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                          {selectedCustomer.phone || 'No phone'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedCustomer(null)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${
                        isLight ? 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200' : 'bg-white/10 hover:bg-white/15 text-white'
                      }`}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  /* Search Field and Results Dropdown */
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className={`w-4 h-4 absolute left-3.5 top-3 ${isLight ? 'text-slate-400' : 'text-[#8E92A0]'}`} />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by client name or phone number..."
                        className={`pl-10 ${inputClass}`}
                        autoFocus
                      />
                    </div>

                    {/* Filtered Customer List */}
                    <div className={`max-h-40 overflow-y-auto rounded-2xl border divide-y custom-scrollbar ${
                      isLight ? 'bg-slate-50/60 border-slate-200 divide-slate-100' : 'bg-[#16171A] border-white/10 divide-white/5'
                    }`}>
                      {customerList.length > 0 ? (
                        customerList.map((cust) => (
                          <div
                            key={cust.id}
                            onClick={() => handleSelectCustomer(cust)}
                            className={`p-2.5 px-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                              isLight ? 'hover:bg-blue-50/80' : 'hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5">
                              <User className="w-3.5 h-3.5 text-blue-500" />
                              <div>
                                <span className={`font-bold text-xs block ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                  {cust.name}
                                </span>
                                <span className={`text-[11px] font-mono ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                                  {cust.phone}
                                  {formatDisplayPhone(cust.phone)}
                                </span>
                              </div>
                            </div>

                            {cust.vehicles && cust.vehicles.length > 0 && (
                              <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                                isLight ? 'bg-slate-200 text-slate-700' : 'bg-white/10 text-zinc-300'
                              }`}>
                                {cust.vehicles[0].make} {cust.vehicles[0].model}
                              </span>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center">
                          <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                            {isSearching ? 'Searching clients...' : 'No matching clients found.'}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setMode('new_customer');
                              setName(searchQuery);
                            }}
                            className="text-xs font-bold text-[#5E81F4] hover:underline mt-1 inline-block"
                          >
                            + Create "{searchQuery || 'New Client'}" manually
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* If selected customer has vehicles */}
                {selectedCustomer && selectedCustomer.vehicles && selectedCustomer.vehicles.length > 0 && (
                  <div className="mt-2.5">
                    <label className={labelClass}>Vehicle</label>
                    <select
                      value={selectedVehicleId}
                      onChange={(e) => setSelectedVehicleId(e.target.value)}
                      className={`${inputClass} cursor-pointer`}
                    >
                      {selectedCustomer.vehicles.map((veh: any) => (
                        <option key={veh.id} value={veh.id} className={isLight ? 'bg-white text-slate-900' : 'bg-[#1C1D21] text-white'}>
                          {veh.make} {veh.model} {veh.reg_number ? `(${veh.reg_number})` : ''}
                        </option>
                      ))}
                      <option value="" className={isLight ? 'bg-white text-slate-900' : 'bg-[#1C1D21] text-white'}>
                        + Add another vehicle below
                      </option>
                    </select>
                  </div>
                )}

                {selectedCustomer && (!selectedCustomer.vehicles || selectedCustomer.vehicles.length === 0 || !selectedVehicleId) && (
                  <div className="mt-2">
                    <label className={labelClass}>Vehicle Details (Make & Model)</label>
                    <input
                      type="text"
                      placeholder="e.g. BMW 330i or Porsche 911"
                      value={vehicle}
                      onChange={(e) => setVehicle(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                )}
              </div>
            ) : (
              /* New Customer Form Fields */
              <div className="space-y-3 p-3.5 rounded-2xl border bg-slate-50/50 dark:bg-[#16171A]/50 border-slate-200 dark:border-white/5">
                <div>
                  <label className={labelClass}>Customer Name *</label>
                  <div className="relative">
                    <User className={`w-4 h-4 absolute left-3.5 top-3 ${isLight ? 'text-slate-400' : 'text-[#8E92A0]'}`} />
                    <input
                      type="text"
                      placeholder="e.g. Vikramaditya Singh"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required={mode === 'new_customer'}
                      className={`pl-10 ${inputClass}`}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Phone Number *</label>
                  <div className="relative">
                    <Phone className={`w-4 h-4 absolute left-3.5 top-3 ${isLight ? 'text-slate-400' : 'text-[#8E92A0]'}`} />
                    <input
                      type="tel"
                      placeholder="e.g. +91 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required={mode === 'new_customer'}
                      className={`pl-10 ${inputClass} font-mono`}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Vehicle (Make & Model)</label>
                  <div className="relative">
                    <Car className={`w-4 h-4 absolute left-3.5 top-3 ${isLight ? 'text-slate-400' : 'text-[#8E92A0]'}`} />
                    <input
                      type="text"
                      placeholder="e.g. Mercedes-Benz C200"
                      value={vehicle}
                      onChange={(e) => setVehicle(e.target.value)}
                      className={`pl-10 ${inputClass}`}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Detailing Service Package & Stage */}
          <div className={`pt-4 border-t ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
            <label className={labelClass}>2. Studio Service & Booking Stage</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium block mb-1">Service Package *</label>
                <div className="relative">
                  <Shield className={`w-4 h-4 absolute left-3.5 top-3 ${isLight ? 'text-slate-400' : 'text-[#8E92A0]'}`} />
                  <select
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    required
                    className={`pl-10 ${inputClass} cursor-pointer`}
                  >
                    <option value="">Select detailing service...</option>
                    {services.map((srv) => (
                      <option key={srv.id} value={srv.name} className={isLight ? 'bg-white text-slate-900' : 'bg-[#1C1D21] text-white'}>
                        {srv.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium block mb-1">Initial Stage / Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={`${inputClass} cursor-pointer font-semibold`}
                >
                  <option value="new" className={isLight ? 'bg-white text-cyan-800' : 'bg-[#1C1D21] text-cyan-400'}>New Inquiry</option>
                  <option value="contacted" className={isLight ? 'bg-white text-purple-800' : 'bg-[#1C1D21] text-purple-400'}>Contacted / Quoted</option>
                  <option value="scheduled" className={isLight ? 'bg-white text-amber-800' : 'bg-[#1C1D21] text-amber-400'}>Scheduled / Bay Reserved</option>
                  <option value="in_progress" className={isLight ? 'bg-white text-blue-800' : 'bg-[#1C1D21] text-blue-400'}>In Studio / Bay</option>
                  <option value="completed" className={isLight ? 'bg-white text-emerald-800' : 'bg-[#1C1D21] text-emerald-400'}>Delivered</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium block mb-1">Intake Channel</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className={`${inputClass} cursor-pointer`}
                >
                  <option value="walk_in">Studio Walk-In</option>
                  <option value="phone">Phone Call</option>
                  <option value="whatsapp">WhatsApp Direct</option>
                  <option value="instagram">Instagram Direct</option>
                  <option value="website">Website Form</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium block mb-1">Special Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Ceramic wheels requested..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className={`flex items-center justify-end space-x-2.5 pt-4 border-t ${isLight ? 'border-slate-200' : 'border-[#26272E]'}`}>
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
              className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-[#5E81F4] hover:bg-[#4E72EA] text-white text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Adding...' : 'Add Service'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
