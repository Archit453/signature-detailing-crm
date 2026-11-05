import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Search,
  ArrowLeft,
  Send,
  Bot,
  Info,
  Play,
  Pause,
  MessageCircle,
  CheckCheck,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { InstagramIcon, WhatsAppIcon } from './Icons';
import type { Conversation, Message, InstagramComment } from '../types';
import { api } from '../lib/api';
import { VehicleDossierSheet } from './VehicleDossierSheet';
import { useTheme } from '../context/ThemeContext';

interface InboxViewProps {
  initialCustomerId?: string | null;
}

function formatMessagePreview(text?: string | null): string {
  if (!text) return 'No messages yet';
  if (text.startsWith('SERVICE_')) {
    const raw = text.replace('SERVICE_', '');
    const serviceLabels: Record<string, string> = {
      ceramic: '✨ Selected: Ceramic Coating',
      ppf: '🛡️ Selected: Paint Protection Film (PPF)',
      interior: '🧼 Selected: Deep Interior Spa',
      rubbing: '✨ Selected: Paint Correction & Polish',
      graphene: '⚡ Selected: Graphene Coating',
    };
    return serviceLabels[raw] || `✨ Selected: ${raw.charAt(0).toUpperCase() + raw.slice(1)}`;
  }
  if (text === 'ACTION_SERVICES') return '🚗 Viewed Detailing Packages';
  if (text === 'ACTION_LOCATION') return '📍 Asked for Studio Location';
  if (text === 'ACTION_WEBSITE') return '🌐 Visited Studio Website';
  if (text === 'ACTION_TALK_HUMAN') return '👤 Requested Specialist Callback';
  if (text === 'PHONE_CHANGE') return '📱 Requested Phone Number Change';
  if (text === 'START_FLOW') return '👋 Started Detailing Inquiry';
  return text;
}

export const InboxView: React.FC<InboxViewProps> = ({ initialCustomerId }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [activeSubTab, setActiveSubTab] = useState<'threads' | 'comments'>('threads');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [comments, setComments] = useState<InstagramComment[]>([]);
  const [channelFilter, setChannelFilter] = useState<'all' | 'whatsapp' | 'instagram'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputContent, setInputContent] = useState('');
  const [messageType, setMessageType] = useState<'text' | 'internal_note'>('text');
  const [isSending, setIsSending] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations
  const fetchConversations = async () => {
    try {
      const data = await api.getConversations(channelFilter);
      setConversations(data);
    } catch (err: any) {
      console.warn('Failed to load conversations:', err.message);
    }
  };

  // Load Instagram comments
  const fetchComments = async () => {
    try {
      const data = await api.getInstagramComments();
      setComments(data);
    } catch (err: any) {
      console.warn('Failed to load comments:', err.message);
    }
  };

  useEffect(() => {
    fetchConversations();
    fetchComments();
    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchConversations();
      if (activeSubTab === 'comments') fetchComments();
    }, 6000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchConversations();
        if (activeSubTab === 'comments') fetchComments();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [channelFilter, activeSubTab]);

  useEffect(() => {
    if (initialCustomerId && conversations.length > 0 && !selectedConversation) {
      const match = conversations.find((c) => c.customer_id === initialCustomerId);
      if (match) {
        loadMessages(match);
      }
    }
  }, [initialCustomerId, conversations, selectedConversation]);

  // Load active conversation messages
  const loadMessages = async (conv: Conversation) => {
    setSelectedConversation(conv);
    try {
      const res = await api.getConversationMessages(conv.id);
      setMessages(res.messages || []);
      if (res.conversation) setSelectedConversation(res.conversation);
    } catch (err: any) {
      console.warn('Failed to load messages:', err.message);
    } finally {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  // Send message or internal note
  const handleSendMessage = async (textToSend?: string) => {
    const content = textToSend || inputContent;
    if (!selectedConversation || !content.trim() || isSending) return;

    setIsSending(true);
    try {
      await api.sendMessage(selectedConversation.id, content.trim(), messageType);
      setInputContent('');
      // Reload messages
      const res = await api.getConversationMessages(selectedConversation.id);
      setMessages(res.messages || []);
      if (res.conversation) setSelectedConversation(res.conversation);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    } catch (err: any) {
      alert(`Delivery failed: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  // Toggle Bot Pause / Resume
  const handleToggleBot = async () => {
    if (!selectedConversation) return;
    const newStatus = !selectedConversation.bot_active;
    try {
      await api.toggleBot(selectedConversation.id, newStatus);
      setSelectedConversation({
        ...selectedConversation,
        bot_active: newStatus,
        bot_paused_reason: newStatus ? null : 'manual_toggle',
      });
    } catch (err: any) {
      alert(`Toggle failed: ${err.message}`);
    }
  };

  // Canned response quick chips
  const quickChips = [
    { label: '📍 Studio Location', text: '📍 Signature Detailing Studio\nStudio 4, Detailing Bay Road, Automobile Hub.\nOpen Mon-Sat 9:30 AM - 8:00 PM.' },
    { label: '📍 Studio Location', text: '📍 Signature Detailing Studio\nPlot no - 55, Pahala, Before Utkal Mahindra Service, Bhubaneswar, Odisha 752101.\nGoogle Maps: https://maps.app.goo.gl/TP4S4MommkGLpAzP7' },
    { label: '📞 Request Call', text: 'Our detailing specialist has been notified and will call you on this number shortly.' },
    { label: '📅 Slot Confirmed', text: 'Your studio detailing bay slot has been reserved. Looking forward to welcoming your vehicle! ✨' },
    { label: '🚗 Car Ready', text: 'Your vehicle detailing is complete and inspected! Ready for showroom delivery. 🏎️✨' },
    { label: '🌐 Website Link', text: 'Visit our official website to view our transformations and gallery: https://signaturedetailing.in' },
    { label: '🌐 Website Link', text: 'Visit our official website to explore our packages & gallery: https://signature-detailing-landing-page.signaturedetailing-bbsr.workers.dev/' },
  ];


  const filteredConversations = conversations.filter((c) => {
    const nameMatch = (c.customer?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const phoneMatch = c.channel_user_id.includes(searchQuery);
    return nameMatch || phoneMatch;
  });

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden pb-16 font-sans transition-colors duration-200 ${
      isLight ? 'bg-transparent text-slate-900' : 'bg-[#16171A] text-white'
    }`}>
      {/* Sub-tab Navigation (DMs vs Instagram Comments) */}
      {!selectedConversation && (
        <div className={`px-4 pt-3 pb-2 flex items-center justify-between border-b transition-all ${
            isLight ? 'border-slate-200/80 bg-white/95 backdrop-blur' : 'border-[#26272E] bg-[#1C1D21]/90 backdrop-blur'
          }`}>
          <div className={`flex items-center space-x-1.5 p-1 rounded-xl border ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#16171A] border-[#282930]'
            }`}>
            <button
              onClick={() => setActiveSubTab('threads')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeSubTab === 'threads'
                  ? 'bg-[#5E81F4] text-white shadow-[0_0_12px_rgba(94,129,244,0.3)]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Direct Chats
            </button>
            <button
              onClick={() => setActiveSubTab('comments')}
              className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeSubTab === 'comments'
                  ? 'bg-pink-600 text-white shadow-[0_0_8px_rgba(225,48,108,0.4)]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <InstagramIcon className="w-3 h-3" />
              <span>IG Comments</span>
              {comments.length > 0 && (
                <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                  {comments.length}
                </span>
              )}
            </button>
          </div>

          {/* Channel Filters for Direct Chats */}
          {activeSubTab === 'threads' && (
            <div className="flex items-center space-x-1 text-xs">
              <button
                onClick={() => setChannelFilter('all')}
                className={`px-2 py-1 rounded ${channelFilter === 'all' ? 'text-[#5E81F4] font-bold' : 'text-zinc-400'}`}
              >
                All
              </button>
              <button
                onClick={() => setChannelFilter('whatsapp')}
                className={`px-2 py-1 rounded flex items-center space-x-1 ${channelFilter === 'whatsapp' ? 'text-emerald-400 font-bold' : 'text-zinc-400'}`}
              >
                <MessageCircle className="w-3 h-3" />
                <span>WA</span>
              </button>
              <button
                onClick={() => setChannelFilter('instagram')}
                className={`px-2 py-1 rounded flex items-center space-x-1 ${channelFilter === 'instagram' ? 'text-pink-400 font-bold' : 'text-zinc-400'}`}
              >
                <InstagramIcon className="w-3 h-3" />
                <span>IG</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* SCREEN A: CONVERSATION THREADS LIST */}
      {!selectedConversation && activeSubTab === 'threads' && (
        <div className="flex-1 flex flex-col overflow-y-auto px-4 py-3">
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by customer name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl border text-xs transition-all focus:outline-none focus:border-[#5E81F4] ${
                isLight ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 shadow-xs' : 'bg-[#1C1D21] border-[#282930] text-white placeholder-zinc-500'
              }`}
            />
          </div>

          {filteredConversations.length > 0 ? (
            <div className="space-y-2">
              {filteredConversations.map((conv) => {
                const isWA = conv.channel === 'whatsapp';
                const hasVehicle = conv.customer?.vehicles && conv.customer.vehicles.length > 0;
                const vehicleLabel = hasVehicle
                  ? `${conv.customer!.vehicles![0].make} ${conv.customer!.vehicles![0].model}`
                  : null;

                const displayName = (conv.customer?.name && conv.customer.name !== 'Customer' && conv.customer.name !== 'Instagram User')
                  ? conv.customer.name
                  : (conv.customer_name && conv.customer_name !== 'Customer' && conv.customer_name !== 'Instagram User')
                    ? conv.customer_name
                    : (isWA && conv.channel_user_id
                        ? `+91 ${conv.channel_user_id.replace(/\D/g, '').slice(-10)}`
                        : (conv.channel === 'instagram' ? 'Instagram User' : 'Customer'));

                // Clean initial for avatar
                const isPhoneTitle = displayName.startsWith('+');
                const avatarLetter = isPhoneTitle ? '📱' : displayName[0]?.toUpperCase() || 'C';

                return (
                  <div
                    key={conv.id}
                    onClick={() => loadMessages(conv)}
                    className={`p-3.5 rounded-2xl border hover:border-[#5E81F4]/50 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-between ${
                      isLight
                        ? 'bg-white border-slate-200/90 shadow-sm hover:shadow-md'
                        : 'bg-[#1C1D21] border-[#282930] hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="relative">
                        <div
                          className={`w-10 h-10 rounded-full border flex items-center justify-center font-bold text-sm uppercase ${
                            isLight
                              ? 'bg-gradient-to-tr from-blue-50 to-indigo-100 border-blue-200 text-blue-700'
                              : 'bg-[#16171A] border-[#282930] text-[#CDD8FC]'
                          }`}
                        >
                          {avatarLetter}
                        </div>
                        <div
                          className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center shadow-xs ${
                            isWA ? 'bg-emerald-500 text-black' : 'bg-pink-500 text-white'
                          }`}
                        >
                          {isWA ? <MessageCircle className="w-2.5 h-2.5" /> : <InstagramIcon className="w-2.5 h-2.5" />}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center justify-between">
                          <h4
                            className={`text-sm font-semibold truncate ${
                              isLight ? 'text-slate-900' : 'text-white'
                            }`}
                          >
                            {displayName}
                          </h4>
                          <span
                            className={`text-[10px] ml-2 whitespace-nowrap ${
                              isLight ? 'text-slate-400' : 'text-zinc-500'
                            }`}
                          >
                            {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {vehicleLabel && (
                          <span
                            className={`inline-block text-[10px] font-semibold truncate mt-0.5 ${
                              isLight ? 'text-blue-700' : 'text-[#CDD8FC]'
                            }`}
                          >
                            🚗 {vehicleLabel}
                          </span>
                        )}

                        <p
                          className={`text-xs truncate mt-0.5 ${
                            isLight ? 'text-slate-500' : 'text-[#8E92A0]'
                          }`}
                        >
                          {formatMessagePreview(conv.last_message_preview)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end space-y-1 ml-2">
                      {conv.unread_count > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[#5E81F4] text-white text-[10px] font-bold shadow-xs">
                          {conv.unread_count}
                        </span>
                      )}
                      {!conv.bot_active && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/25 font-semibold whitespace-nowrap">
                          {conv.bot_paused_reason === 'user_requested_human' ? '👤 Human Needed' : 'Bot Paused'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <MessageSquare className={`w-8 h-8 ${isLight ? 'text-slate-400' : 'text-zinc-600'} mb-2`} />
              <p className={`text-sm font-semibold ${isLight ? 'text-slate-700' : 'text-zinc-400'}`}>No active conversations found</p>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-500'} mt-1`}>
                Incoming inquiries from WhatsApp, Instagram, and web forms will appear here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* SUB-SCREEN: INSTAGRAM REELS & POST COMMENTS FEED */}
      {!selectedConversation && activeSubTab === 'comments' && (
        <div className="flex-1 flex flex-col overflow-y-auto px-4 py-3 space-y-2.5">
          <div className={`p-3 rounded-2xl border mb-1 ${
            isLight ? 'bg-pink-50/80 border-pink-200' : 'bg-pink-950/20 border-pink-500/20'
          }`}>
            <span className="text-xs font-bold text-pink-500 flex items-center space-x-1.5">
              <InstagramIcon className="w-3.5 h-3.5" />
              <span>Organic Comment-to-DM Engine</span>
            </span>
            <p className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
              When users comment on Reels or Posts, the system automatically posts a public thank-you reply and sends them a private DM with service cards.
            </p>
          </div>

          {comments.length > 0 ? (
            comments.map((comment) => (
              <div
                key={comment.id}
                className={`p-3 rounded-2xl border text-xs space-y-2 ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#1C1D21] border-[#282930]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-pink-500 flex items-center space-x-1">
                    <span>@{comment.from_username}</span>
                  </span>
                  <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>
                    {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <p className={`text-xs p-2.5 rounded-xl border font-sans ${
                  isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#121316] border-white/5 text-zinc-200'
                }`}>
                  "{comment.text}"
                </p>

                {comment.public_reply_text && (
                  <p className="text-[11px] text-pink-600 italic pl-2 border-l-2 border-pink-500/40">
                    Auto-Reply: {comment.public_reply_text}
                  </p>
                )}
              </div>
            ))
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <InstagramIcon className={`w-8 h-8 ${isLight ? 'text-slate-400' : 'text-zinc-600'} mb-2`} />
              <p className={`text-sm font-semibold ${isLight ? 'text-slate-700' : 'text-zinc-400'}`}>No Instagram comments logged yet</p>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-500'} mt-1`}>
                Comments on your Instagram posts and Reels will automatically appear here with automated DM logs.
              </p>
            </div>
          )}
        </div>
      )}

      {/* SCREEN B: ACTIVE CONVERSATION CHAT VIEW */}
      {selectedConversation && (
        <div className={`flex-1 flex flex-col h-full overflow-hidden ${isLight ? 'bg-slate-50' : 'bg-[#16171A]'}`}>
          <div className={`px-4 py-3 border-b flex items-center justify-between z-10 transition-colors ${
            isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#1C1D21] border-[#26272E]'
          }`}>
            <div className="flex items-center space-x-2.5">
              <button
                onClick={() => setSelectedConversation(null)}
                className={`p-1.5 -ml-1 rounded-lg transition-all ${
                  isLight ? 'hover:bg-slate-100 text-slate-600 hover:text-slate-900' : 'hover:bg-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className={`text-sm font-semibold truncate max-w-[200px] ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}>
                    {(selectedConversation.customer?.name && selectedConversation.customer.name !== 'Customer' && selectedConversation.customer.name !== 'Instagram User')
                      ? selectedConversation.customer.name
                      : (selectedConversation.customer_name && selectedConversation.customer_name !== 'Customer' && selectedConversation.customer_name !== 'Instagram User')
                        ? selectedConversation.customer_name
                        : (selectedConversation.channel === 'whatsapp' && selectedConversation.channel_user_id
                            ? `+91 ${selectedConversation.channel_user_id.replace(/\D/g, '').slice(-10)}`
                            : (selectedConversation.channel === 'instagram' ? 'Instagram User' : 'Customer'))}
                  </h3>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase ${
                      selectedConversation.channel === 'whatsapp'
                        ? isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-500/20 text-emerald-400'
                        : isLight ? 'bg-pink-100 text-pink-800' : 'bg-pink-500/20 text-pink-400'
                    }`}
                  >
                    {selectedConversation.channel === 'whatsapp' ? 'WhatsApp' : 'Instagram'}
                  </span>
                </div>
                <span className={`text-[10px] block font-mono ${
                  isLight ? 'text-slate-400' : 'text-zinc-400'
                }`}>
                  {selectedConversation.channel_user_id}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleToggleBot}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all ${
                  selectedConversation.bot_active
                    ? isLight
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs'
                      : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : isLight
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                    : 'bg-[#5E81F4]/15 text-[#CDD8FC] border border-[#5E81F4]/30'
                }`}
              >
                {selectedConversation.bot_active ? (
                  <>
                    <Pause className="w-3 h-3" />
                    <span>Bot Active</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3" />
                    <span>Bot Paused</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setIsDossierOpen(true)}
                className={`p-2 rounded-xl transition-all border ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border-[#282930]'
                }`}
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!selectedConversation.bot_active && (
            <div className={`px-4 py-2 border-b text-xs flex items-center justify-between ${
              isLight ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-[#1C1D21] border-amber-500/20 text-amber-300'
            }`}>
              <span>
                {selectedConversation.bot_paused_reason === 'user_requested_human'
                  ? '👤 Customer requested to speak with a human agent.'
                  : selectedConversation.bot_paused_reason === 'instagram_echo'
                  ? '📱 Staff replied via Instagram Mobile App. Bot is paused.'
                  : selectedConversation.bot_paused_reason === 'coexistence_echo'
                  ? '📱 Staff replied via WhatsApp Mobile App. Bot is paused.'
                  : selectedConversation.bot_paused_reason === 'unhandled_fallback'
                  ? '⚠️ Customer asked complex questions. Bot transferred to human.'
                  : selectedConversation.bot_paused_reason === 'manual_takeover'
                  ? '👨‍💻 Staff intervened from CRM Inbox. Bot is paused.'
                  : '⏸️ Bot is currently paused for human takeover.'}
              </span>
              <button
                onClick={handleToggleBot}
                className="text-xs font-semibold text-[#5E81F4] underline ml-2 hover:text-[#4d6fd9] whitespace-nowrap"
              >
                Resume Bot
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg) => {
              const isOutbound = msg.direction === 'outbound';
              const isInternalNote = msg.message_type === 'internal_note';
              const isBot = msg.sender_type === 'bot';

              if (isInternalNote) {
                return (
                  <div key={msg.id} className="flex justify-center my-1.5">
                    <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl border text-xs shadow-sm ${
                      isLight
                        ? 'bg-amber-50/95 border-amber-200 text-amber-950'
                        : 'bg-[#1C1D21] border-[#5E81F4]/30 text-[#CDD8FC]'
                    }`}>
                      <div className="flex items-center space-x-1.5 text-[10px] font-bold text-[#5E81F4] uppercase tracking-wider mb-1">
                        <Lock className="w-3 h-3" />
                        <span>Team Whisper (Staff Only — Hidden from Client)</span>
                      </div>
                      <p className="whitespace-pre-wrap">{formatMessagePreview(msg.content)}</p>
                      <span className={`text-[9px] block text-right mt-1 ${isLight ? 'text-amber-700/60' : 'text-zinc-500'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${
                      isOutbound
                        ? isBot
                          ? isLight
                            ? 'bg-white border border-blue-200 text-slate-800 rounded-br-none shadow-xs'
                            : 'bg-[#1C1D21] border border-[#5E81F4]/30 text-[#CDD8FC] rounded-br-none'
                          : 'bg-[#5E81F4] text-white font-medium rounded-br-none shadow-[0_2px_12px_rgba(94,129,244,0.3)]'
                        : isLight
                        ? 'bg-white border border-slate-200 text-slate-900 rounded-bl-none shadow-xs'
                        : 'bg-[#1C1D21] border border-[#282930] text-zinc-200 rounded-bl-none'
                    }`}
                  >
                    {isOutbound && isBot && (
                      <span className="text-[9px] font-semibold text-[#5E81F4] flex items-center space-x-1 uppercase mb-1">
                        <Bot className="w-3 h-3" />
                        <span>Signature Bot</span>
                      </span>
                    )}

                    <p className="whitespace-pre-wrap">{formatMessagePreview(msg.content)}</p>

                    <div className={`flex items-center justify-end space-x-1 mt-1 text-[9px] ${
                      isOutbound && !isBot ? 'text-white/70' : isLight ? 'text-slate-400' : 'text-zinc-500'
                    }`}>
                      <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {isOutbound && <CheckCheck className="w-3 h-3" />}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className={`px-3 py-2 border-t flex items-center space-x-2 overflow-x-auto no-scrollbar ${
            isLight ? 'bg-slate-100/70 border-slate-200' : 'bg-[#1C1D21] border-[#26272E]'
          }`}>
            {quickChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip.text)}
                className={`whitespace-nowrap px-3 py-1 rounded-full border text-[11px] font-medium transition-all active:scale-95 ${
                  isLight
                    ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-blue-600 shadow-xs'
                    : 'bg-[#16171A] hover:bg-white/[0.08] border-[#282930] text-zinc-300 hover:text-[#5E81F4]'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
          {/* Action & Reply Bar */}
          <div className={`p-3 border-t space-y-2.5 ${isLight ? 'bg-white border-slate-200' : 'bg-[#1C1D21] border-[#26272E]'}`}>
            {/* Quick 1-tap external app open */}
            <div className="flex items-center space-x-2">
              {selectedConversation.channel === 'whatsapp' ? (
                <a
                  href={`https://wa.me/${(selectedConversation.customer?.phone || selectedConversation.channel_user_id).replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-3 rounded-xl font-semibold flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all active:scale-[0.99] text-xs"
                >
                  <WhatsAppIcon className="w-3.5 h-3.5" />
                  <span>Open & Chat on WhatsApp</span>
                  <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
                </a>
              ) : (
                <a
                  href={`https://ig.me/m/${selectedConversation.channel_user_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-3 rounded-xl font-semibold flex items-center justify-center space-x-2 bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:opacity-95 text-white shadow-xs transition-all active:scale-[0.99] text-xs"
                >
                  <InstagramIcon className="w-3.5 h-3.5" />
                  <span>Open & Chat on Instagram Direct</span>
                  <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
                </a>
              )}
            </div>

            {/* Type selector: Direct Reply vs Internal Note */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setMessageType('text')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  messageType === 'text'
                    ? 'bg-[#5E81F4] text-white shadow'
                    : isLight
                    ? 'bg-slate-100 text-slate-600 hover:text-slate-900'
                    : 'bg-white/[0.04] text-zinc-400 hover:text-white'
                }`}
              >
                💬 Direct Reply
              </button>
              <button
                type="button"
                onClick={() => setMessageType('internal_note')}
                className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  messageType === 'internal_note'
                    ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40 shadow'
                    : isLight
                    ? 'bg-slate-100 text-slate-600 hover:text-slate-900'
                    : 'bg-white/[0.04] text-zinc-400 hover:text-white'
                }`}
              >
                <Lock className="w-3 h-3" />
                <span>Internal Note</span>
              </button>
            </div>

            {/* Reply Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center space-x-2"
            >
              <textarea
                rows={1}
                placeholder={
                  messageType === 'internal_note'
                    ? 'Write an internal workshop note (hidden from customer)...'
                    : `Reply via ${selectedConversation.channel === 'whatsapp' ? 'WhatsApp' : 'Instagram Direct'}...`
                }
                value={inputContent}
                onChange={(e) => setInputContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className={`flex-1 px-3.5 py-2 rounded-xl text-xs focus:outline-none transition-all resize-none ${
                  isLight
                    ? messageType === 'internal_note'
                      ? 'bg-amber-50/60 border border-amber-300 text-slate-900 placeholder:text-amber-700/60 focus:border-amber-500'
                      : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#5E81F4]'
                    : messageType === 'internal_note'
                    ? 'bg-[#16171A] border border-amber-500/30 text-white placeholder-zinc-500 focus:border-amber-500'
                    : 'bg-[#16171A] border border-[#282930] text-white placeholder-zinc-500 focus:border-[#5E81F4]'
                }`}
              />

              <button
                type="submit"
                disabled={!inputContent.trim() || isSending}
                className={`p-2.5 rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-50 ${
                  messageType === 'internal_note'
                    ? 'bg-amber-600 text-white hover:bg-amber-500 shadow'
                    : 'bg-[#5E81F4] text-white hover:bg-[#4D70E3] shadow-[0_0_12px_rgba(94,129,244,0.3)]'
                }`}
                title={messageType === 'internal_note' ? 'Save Internal Note' : 'Send Message'}
              >
                {messageType === 'internal_note' ? <Lock className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </div>

          <VehicleDossierSheet
            isOpen={isDossierOpen}
            onClose={() => setIsDossierOpen(false)}
            customer={selectedConversation.customer || null}
            onVehicleAdded={(veh) => {
              if (selectedConversation.customer) {
                const currentVehicles = selectedConversation.customer.vehicles || [];
                setSelectedConversation({
                  ...selectedConversation,
                  customer: {
                    ...selectedConversation.customer,
                    vehicles: [veh, ...currentVehicles],
                  },
                });
              }
            }}
          />
        </div>
      )}
    </div>
  );
};
