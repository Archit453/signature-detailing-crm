export interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  instagram_id?: string | null;
  instagram_username?: string | null;
  email?: string | null;
  notes?: string | null;
  created_at: string;
  vehicles?: Vehicle[];
}

export interface Vehicle {
  id: string;
  customer_id: string;
  make: string;
  model: string;
  year?: number | null;
  color?: string | null;
  reg_number?: string | null;
  paint_condition?: string | null;
  inspection_notes?: string | null;
  created_at: string;
}

export interface StudioService {
  id: string;
  name: string;
  short_code: string;
  tagline?: string | null;
  description?: string | null;
  is_active: boolean;
  order_index: number;
}

export type LeadStatus = 'new' | 'contacted' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface Lead {
  id: string;
  customer_id: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  instagram_id?: string | null;
  instagram_username?: string | null;
  phone?: string | null;
  vehicle_id?: string | null;
  service_id?: string | null;
  service_name: string;
  source: 'website' | 'whatsapp' | 'instagram' | 'phone' | 'walk_in';
  status: LeadStatus;
  scheduled_date?: string | null;
  notes?: string | null;
  created_at: string;
  customer?: Customer;
  vehicle?: Vehicle;
}

export interface Conversation {
  id: string;
  customer_id: string;
  customer_name?: string | null;
  channel: 'whatsapp' | 'instagram';
  channel_user_id: string;
  bot_active: boolean;
  bot_paused_reason?: string | null;
  bot_step?: string | null;
  last_message_preview?: string | null;
  last_message_at: string;
  unread_count: number;
  created_at: string;
  customer?: Customer;
}

export interface Message {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  sender_type: 'customer' | 'bot' | 'agent';
  message_type: 'text' | 'image' | 'video' | 'button_reply' | 'internal_note' | 'template';
  content: string;
  media_url?: string | null;
  meta_message_id?: string | null;
  created_at: string;
}

export interface InstagramComment {
  id: string;
  media_id?: string;
  from_username: string;
  from_id?: string;
  text: string;
  public_replied: boolean;
  public_reply_text?: string;
  private_dm_sent: boolean;
  created_at: string;
}

export interface PipelineKPIs {
  counts: {
    total: number;
    new: number;
    contacted: number;
    scheduled: number;
    in_progress: number;
    completed: number;
    cancelled: number;
  };
  channelBreakdown: {
    website: number;
    whatsapp: number;
    instagram: number;
    other: number;
  };
  activeJobs: number;
  conversionRate: number;
}

