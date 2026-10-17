import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Edit3,
  Send,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import type { Lead } from '../types';
import { useTheme } from '../context/ThemeContext';
import { api } from '../lib/api';

interface ServiceCompletionModalProps {
  isOpen: boolean;
  lead: Lead | null;
  onClose: () => void;
  onConfirmCompletion: (leadId: string) => Promise<void>;
  onFinished: () => void;
}

export const ServiceCompletionModal: React.FC<ServiceCompletionModalProps> = ({
  isOpen,
  lead,
  onClose,
  onConfirmCompletion,
  onFinished,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [sendReview, setSendReview] = useState(true);
  const [isEditingMessage, setIsEditingMessage] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [reviewLink, setReviewLink] = useState('https://search.google.com/local/writereview?placeid=ChIJey82fSsLGToRc9YiRRlQJ2Q');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load Review Settings & construct initial message template
  useEffect(() => {
    if (!isOpen || !lead) return;

    setIsEditingMessage(false);
    setIsSubmitting(false);

    const hasPhone = Boolean(lead.customer?.phone);
    setSendReview(hasPhone);

    const initMessage = async () => {
      let link = 'https://search.google.com/local/writereview?placeid=ChIJey82fSsLGToRc9YiRRlQJ2Q';
      let template =
        "Hi {{customer_name}} 👋 Thank you for choosing Signature Detailing. We hope you loved the service on your {{vehicle_name}}. If you have a minute, we'd really appreciate a review:\n⭐ {{review_link}}\n\nThank you for your trust. - Signature Detailing";

      try {
        const settings = await api.getReviewSettings();
        if (settings) {
          if (settings.review_link) link = settings.review_link;
          if (settings.template) template = settings.template;
        }
      } catch (e) {
        console.warn('Could not load review settings from server, using defaults.', e);
      }

      setReviewLink(link);

      // Interpolate variables
      const rawName = lead.customer?.name || 'Valued Client';
      const firstName = rawName.split(' ')[0] || rawName;

      const firstVeh =
        lead.customer?.vehicles && lead.customer.vehicles.length > 0
          ? lead.customer.vehicles[0]
          : lead.vehicle;
      const vehicleDesc = firstVeh
        ? `${firstVeh.make} ${firstVeh.model}`.trim()
        : 'vehicle';

      const populated = template
        .replace(/\{\{customer_name\}\}/g, firstName)
        .replace(/\{\{vehicle_name\}\}/g, vehicleDesc)
        .replace(/\{\{service\}\}/g, lead.service_name || 'detailing')
        .replace(/\{\{review_link\}\}/g, link);

      setMessageText(populated);
    };

    initMessage();
  }, [isOpen, lead]);

  if (!isOpen || !lead) return null;

  const firstVehicle =
    lead.customer?.vehicles && lead.customer.vehicles.length > 0
      ? lead.customer.vehicles[0]
      : lead.vehicle;

  const vehicleString = firstVehicle
    ? `${firstVehicle.make} ${firstVehicle.model}${firstVehicle.reg_number ? ` (${firstVehicle.reg_number})` : ''}`
    : 'Vehicle specs pending';

  const customerPhone = lead.customer?.phone;

  // Streamlined 1-step completion and direct review dispatch
  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      // 1. Mark as Delivered / Completed in CRM
      await onConfirmCompletion(lead.id);

      // 2. Record completion in activity timeline
      if (lead.customer_id) {
        try {
          await api.addCustomerActivity(lead.customer_id, {
            type: 'service_completed',
            title: 'Service Delivered',
            description: `${lead.service_name} delivered on ${vehicleString}`,
            channel: 'studio',
          });
        } catch (actErr) {
          console.warn('Could not log completion activity:', actErr);
        }
      }

      // 3. Directly dispatch review request via Meta WhatsApp API (server-side, NO popup)
      if (sendReview && customerPhone) {
        try {
          const res = await api.sendLeadReview(lead.id, messageText);
          if (res?.error) {
            console.warn('[Review Dispatch] Server reported warning:', res.error);
          }
        } catch (revErr: any) {
          console.error('[Review Dispatch Failed]', revErr);
          alert(`Service marked as delivered, but WhatsApp review could not be sent: ${revErr.message || revErr}`);
        }
      }

      onFinished();
    } catch (err: any) {
      alert(`Failed to complete service: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in font-sans">
      <div
        className={`relative w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col border transition-all ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-[#1C1D21] border-[#282930] text-white'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isLight ? 'border-slate-200 bg-slate-50/90' : 'border-[#282930] bg-[#18191E]'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shadow-sm">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-base font-bold leading-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Deliver & Complete Service
              </h3>
              <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-[#8E92A0]'}`}>
                Confirm job delivery and notify customer
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900'
                : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Service Summary Card */}
          <div
            className={`p-4 rounded-2xl border space-y-2.5 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#16171A] border-white/[0.06]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Customer:
              </span>
              <span className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {lead.customer?.name || 'Walk-in Client'}
                {customerPhone && (
                  <span className="font-normal text-xs text-zinc-500 ml-2">({customerPhone})</span>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Vehicle:
              </span>
              <span className={`text-sm font-semibold ${isLight ? 'text-blue-700' : 'text-[#CDD8FC]'}`}>
                {vehicleString}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Service:
              </span>
              <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                {lead.service_name}
              </span>
            </div>
          </div>

          {/* WhatsApp Review Request Option */}
          <div
            className={`p-4 rounded-2xl border space-y-3 transition-colors ${
              sendReview
                ? isLight
                  ? 'bg-emerald-50/50 border-emerald-200'
                  : 'bg-emerald-950/20 border-emerald-500/30'
                : isLight
                ? 'bg-slate-50 border-slate-200 opacity-80'
                : 'bg-[#16171A] border-white/5 opacity-80'
            }`}
          >
            <label className="flex items-start space-x-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sendReview}
                onChange={(e) => setSendReview(e.target.checked)}
                disabled={!customerPhone}
                className="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-400"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Send Google Review request directly via WhatsApp
                  </span>
                  {sendReview && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setIsEditingMessage(!isEditingMessage);
                      }}
                      className={`text-[11px] font-semibold flex items-center space-x-1 px-2 py-0.5 rounded-lg border transition-colors ${
                        isLight
                          ? 'bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                          : 'bg-white/10 border-white/15 text-emerald-300 hover:bg-white/20'
                      }`}
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{isEditingMessage ? 'View Preview' : 'Edit'}</span>
                    </button>
                  )}
                </div>
                <p className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                  {customerPhone
                    ? 'Dispatched directly to customer from studio WhatsApp bot'
                    : 'Customer does not have a phone number on file'}
                </p>
              </div>
            </label>

            {/* Editable or Preview Message */}
            {sendReview && (
              <div className="space-y-2 pt-1">
                {isEditingMessage ? (
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    rows={5}
                    className={`w-full p-3 rounded-xl border text-xs font-sans focus:outline-none transition-all leading-relaxed ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500'
                        : 'bg-[#16171A] border-white/15 text-white focus:border-emerald-500'
                    }`}
                    placeholder="Customize review message..."
                  />
                ) : (
                  <div
                    className={`p-3 rounded-xl text-xs leading-relaxed border whitespace-pre-wrap ${
                      isLight
                        ? 'bg-white/80 border-emerald-200 text-slate-800'
                        : 'bg-black/30 border-white/10 text-zinc-300'
                    }`}
                  >
                    {messageText}
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] px-1 text-zinc-500">
                  <span className="truncate max-w-[280px]">Link: {reviewLink}</span>
                  <a
                    href={reviewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-500 hover:underline flex items-center space-x-0.5 shrink-0"
                  >
                    <span>Test link</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div
            className={`flex items-center justify-end space-x-3 pt-4 border-t ${
              isLight ? 'border-slate-200' : 'border-[#282930]'
            }`}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  : 'bg-white/5 hover:bg-white/10 text-zinc-300'
              }`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : sendReview ? (
                <>
                  <Send className="w-4 h-4" />
                  <span>Deliver & Send Review</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Deliver Vehicle</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
