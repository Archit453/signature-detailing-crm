import React, { useState } from 'react';
import { X, Car, Phone, Plus } from 'lucide-react';
import { InstagramIcon, WhatsAppIcon } from './Icons';
import type { Customer, Vehicle } from '../types';
import { api } from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { formatDisplayPhone } from '../lib/formatters';

interface VehicleDossierSheetProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  activeLeadStatus?: string;
  leadId?: string;
  onLeadStatusUpdated?: (newStatus: string) => void;
  onVehicleAdded?: (newVehicle: Vehicle) => void;
}

export const VehicleDossierSheet: React.FC<VehicleDossierSheetProps> = ({
  isOpen,
  onClose,
  customer,
  activeLeadStatus = 'new',
  leadId,
  onLeadStatusUpdated,
  onVehicleAdded,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [showAddForm, setShowAddForm] = useState(false);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [paintCondition, setPaintCondition] = useState('Minor Swirls');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !customer) return null;

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!make.trim() || !model.trim()) return;

    setIsSubmitting(true);
    try {
      const created = await api.addCustomerVehicle(customer.id, {
        make: make.trim(),
        model: model.trim(),
        color: color.trim() || null,
        reg_number: regNumber.trim() || null,
        paint_condition: paintCondition,
        inspection_notes: notes.trim() || null,
      });

      if (onVehicleAdded) onVehicleAdded(created);
      setShowAddForm(false);
      setMake('');
      setModel('');
      setColor('');
      setRegNumber('');
      setNotes('');
    } catch (err: any) {
      alert(`Error saving vehicle: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!leadId || !onLeadStatusUpdated) return;
    try {
      await api.updateLeadStatus(leadId, newStatus);
      onLeadStatusUpdated(newStatus);
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const statusOptions = [
    { id: 'new', label: 'New Lead' },
    { id: 'contacted', label: 'Contacted' },
    { id: 'scheduled', label: 'Scheduled' },
    { id: 'in_progress', label: 'In Studio' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Slide-Up Bottom Sheet */}
      <div className={`relative z-10 w-full max-w-lg rounded-t-2xl md:rounded-2xl max-h-[85vh] overflow-y-auto p-6 shadow-2xl pb-safe font-sans border transition-all ${
        isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#1C1D21] border-[#282930] text-white'
      }`}>
        {/* Drag handle pill */}
        <div className={`w-12 h-1 rounded-full mx-auto mb-4 md:hidden ${
          isLight ? 'bg-slate-300' : 'bg-white/20'
        }`} />

        {/* Header */}
        <div className={`flex items-center justify-between pb-3 border-b ${
          isLight ? 'border-slate-100' : 'border-[#26272E]'
        }`}>
          <div>
            <span className="text-[11px] font-semibold tracking-wider text-[#5E81F4] uppercase block">
              Customer & Vehicle Dossier
            </span>
            <h2 className={`text-xl font-bold mt-0.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>{customer.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contact Badges */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {customer.phone && (
            <>
              <a
                href={`tel:${customer.phone}`}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-xl border text-xs font-bold transition-all ${isLight ? 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200' : 'bg-white/[0.06] border-white/[0.1] text-zinc-200 hover:bg-white/10'}`}
                title="Call Customer"
              >
                <Phone className="w-3 h-3" />
                <span>{customer.phone}</span>
                <span>{formatDisplayPhone(customer.phone)}</span>
              </a>
              <a
                href={`https://wa.me/${customer.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-xl border text-xs font-bold transition-all ${isLight ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100' : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/30'}`}
                title="Chat on WhatsApp"
              >
                <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366]" />
                <span>WhatsApp</span>
              </a>
            </>
          )}
          {customer.instagram_username && (
            <span className={`flex items-center space-x-1.5 px-3 py-1 rounded-xl border text-xs font-bold ${isLight ? 'bg-pink-50 border-pink-300 text-pink-800' : 'bg-pink-950/40 border-pink-500/30 text-pink-400'}`}>
              <InstagramIcon className="w-3 h-3" />
              <span>@{customer.instagram_username}</span>
            </span>
          )}
        </div>

        {/* Pipeline Stage Transition Section */}
        {leadId && (
          <div className={`mt-5 p-4 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#16171A] border-[#282930]'}`}>
            <span className={`text-xs font-semibold block mb-2.5 ${isLight ? 'text-slate-800' : 'text-zinc-300'}`}>
              Lead Lifecycle Stage
            </span>
            <span className="text-xs font-semibold text-zinc-300 block mb-2.5">
              Lead Lifecycle Stage
            </span>
            <div className="grid grid-cols-3 gap-2">
              {statusOptions.map((st) => (
                <button
                  key={st.id}
                  onClick={() => handleStatusChange(st.id)}
                  className={`px-2.5 py-2 rounded-xl text-xs font-medium transition-all text-center ${
                    activeLeadStatus === st.id
                      ? 'bg-[#5E81F4] text-white font-bold shadow-[0_0_12px_rgba(94,129,244,0.35)]'
                      : isLight
                      ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      : 'bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-white'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Vehicles Section */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Car className="w-4 h-4 text-[#5E81F4]" />
              <h3 className={`text-sm font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>Registered Vehicles</h3>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center space-x-1 px-3 py-1 rounded-xl bg-[#5E81F4]/15 hover:bg-[#5E81F4]/25 text-[#5E81F4] text-xs font-semibold transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddForm ? 'Cancel' : 'Add Vehicle'}</span>
            </button>
          </div>

          {/* Add Vehicle Form */}
          {showAddForm && (
            <form onSubmit={handleAddVehicle} className={`p-4 rounded-2xl border mb-3 space-y-3 ${isLight ? 'bg-slate-50 border-blue-200' : 'bg-[#16171A] border-[#5E81F4]/30'}`}>
              <span className={`text-xs font-bold block mb-1 ${isLight ? 'text-blue-700' : 'text-[#5E81F4]'}`}>
                Workshop Inspection — Add Vehicle
              </span>
              <span className="text-xs font-semibold text-[#5E81F4] block mb-1">
                Workshop Inspection — Add Vehicle
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className={`text-[10px] uppercase font-semibold ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>Make *</label>
                  <input
                    type="text"
                    placeholder="e.g. BMW, Porsche"
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    required
                    className={`w-full mt-1 px-3 py-2 rounded-xl border text-xs focus:outline-none transition-all ${isLight ? 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500' : 'bg-[#1C1D21] border-[#282930] text-white placeholder-zinc-500 focus:border-[#5E81F4]'}`}
                  />
                </div>
                <div>
                  <label className={`text-[10px] uppercase font-semibold ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>Model *</label>
                  <input
                    type="text"
                    placeholder="e.g. 330i, 911 GT3"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    required
                    className={`w-full mt-1 px-3 py-2 rounded-xl border text-xs focus:outline-none transition-all ${isLight ? 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500' : 'bg-[#1C1D21] border-[#282930] text-white placeholder-zinc-500 focus:border-[#5E81F4]'}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className={`text-[10px] uppercase font-semibold ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>Color</label>
                  <input
                    type="text"
                    placeholder="e.g. Portimao Blue"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className={`w-full mt-1 px-3 py-2 rounded-xl border text-xs focus:outline-none transition-all ${isLight ? 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500' : 'bg-[#1C1D21] border-[#282930] text-white placeholder-zinc-500 focus:border-[#5E81F4]'}`}
                  />
                </div>
                <div>
                  <label className={`text-[10px] uppercase font-semibold ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>Registration / Plate</label>
                  <input
                    type="text"
                    placeholder="e.g. MH 02 AB 1234"
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value)}
                    className={`w-full mt-1 px-3 py-2 rounded-xl border text-xs uppercase focus:outline-none transition-all ${isLight ? 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500' : 'bg-[#1C1D21] border-[#282930] text-white placeholder-zinc-500 focus:border-[#5E81F4]'}`}
                  />
                </div>
              </div>

              <div>
                <label className={`text-[10px] uppercase font-semibold ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>Paint Condition</label>
                <select
                  value={paintCondition}
                  onChange={(e) => setPaintCondition(e.target.value)}
                  className={`w-full mt-1 px-3 py-2 rounded-xl border text-xs focus:outline-none transition-all cursor-pointer ${isLight ? 'bg-white border-slate-200 text-slate-900 focus:border-blue-500' : 'bg-[#1C1D21] border-[#282930] text-white focus:border-[#5E81F4]'}`}
                >
                  <option value="Good (Factory Paint)">Good (Factory Paint)</option>
                  <option value="Minor Swirls / Light Scratches">Minor Swirls / Light Scratches</option>
                  <option value="Heavy Swirls & Holograms">Heavy Swirls & Holograms</option>
                  <option value="Severe Scratches (Needs 2-Step Correction)">Severe Scratches (Needs 2-Step Correction)</option>
                  <option value="Faded / Oxidized">Faded / Oxidized</option>
                </select>
              </div>

              <div>
                <label className={`text-[10px] uppercase font-semibold ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>Inspection Notes</label>
                <textarea
                  placeholder="e.g. Scratch on rear left bumper, client wants ceramic coating on wheels too."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className={`w-full mt-1 px-3 py-2 rounded-xl border text-xs focus:outline-none transition-all ${isLight ? 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500' : 'bg-[#1C1D21] border-[#282930] text-white placeholder-zinc-500 focus:border-[#5E81F4]'}`}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-[#5E81F4] hover:bg-[#4D70E3] text-white font-semibold text-xs transition-all shadow-[0_0_16px_rgba(94,129,244,0.3)] active:scale-98"
              >
                {isSubmitting ? 'Saving...' : 'Save Vehicle to Dossier'}
              </button>
            </form>
          )}

          {/* Vehicle Cards List */}
          {customer.vehicles && customer.vehicles.length > 0 ? (
            <div className="space-y-2">
              {customer.vehicles.map((v) => (
                <div
                  key={v.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 hover:border-blue-400'
                      : 'bg-[#16171A] border-[#282930] hover:border-[#5E81F4]/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      {v.make} {v.model} {v.year ? `(${v.year})` : ''}
                    </span>
                    {v.reg_number && (
                      <span className={`px-2 py-0.5 rounded-lg border font-mono text-[10px] font-bold ${
                        isLight
                          ? 'bg-white border-slate-200 text-blue-700'
                          : 'bg-[#1C1D21] border-[#282930] text-[#CDD8FC]'
                      }`}>
                        {v.reg_number}
                      </span>
                    )}
                  </div>
                  <div className={`flex items-center space-x-3 mt-1.5 text-xs ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                    {v.color && <span>Color: <strong className={isLight ? 'text-slate-800' : 'text-zinc-200'}>{v.color}</strong></span>}
                    {v.paint_condition && (
                      <span>Paint: <strong className={isLight ? 'text-blue-700' : 'text-[#CDD8FC]'}>{v.paint_condition}</strong></span>
                    )}
                  </div>
                  {v.inspection_notes && (
                    <p className={`text-xs mt-2 p-2.5 rounded-xl border ${
                      isLight
                        ? 'bg-white border-slate-200 text-slate-700'
                        : 'bg-[#1C1D21] border-[#282930] text-[#8E92A0]'
                    }`}>
                      {v.inspection_notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className={`p-5 rounded-2xl border border-dashed text-center ${
              isLight ? 'bg-slate-50 border-slate-300' : 'bg-[#16171A] border-[#282930]'
            }`}>
              <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>No vehicles logged yet.</p>
              <p className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>
                Staff can log vehicle specs and paint condition during consultation.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
