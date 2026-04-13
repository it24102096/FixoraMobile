// ─── User / Auth ────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'technician' | 'admin' | 'customer';
  avatarUrl?: string;
  token?: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegistrationCredentials extends AuthCredentials {
  name: string;
  phone: string;
}

// ─── Job ────────────────────────────────────────────────────────────────────

export type JobStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type JobPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Job {
  id: string;
  title: string;
  description: string;
  status: JobStatus;
  priority: JobPriority;
  customerId: string;
  customerName: string;
  address: string;
  scheduledAt: string;       // ISO date string
  estimatedDuration: number; // minutes
  technicianId?: string;
  technicianName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Appointment ─────────────────────────────────────────────────────────────

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled';

export interface Appointment {
  id: string;
  jobId: string;
  jobTitle: string;
  customerId: string;
  customerName: string;
  technicianId: string;
  technicianName: string;
  scheduledAt: string;
  duration: number; // minutes
  status: AppointmentStatus;
  address: string;
  notes?: string;
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'bank_transfer';

export interface Payment {
  id: string;
  jobId: string;
  invoiceNumber: string;
  amount: number;
  tax: number;
  total: number;
  currency: string;
  status: PaymentStatus;
  method?: PaymentMethod;
  paidAt?: string;
  dueDate: string;
  lineItems: PaymentLineItem[];
}

export interface PaymentLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// ─── Support ─────────────────────────────────────────────────────────────────

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high';

export interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdBy: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  content: string;
  sentAt: string;
}

// ─── Navigation Params ───────────────────────────────────────────────────────

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  Jobs: undefined;
  JobDetails: { jobId: string };
  Appointment: { appointmentId?: string; jobId?: string };
  Payment: { jobId: string; paymentId?: string };
  Support: undefined;
};

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}
