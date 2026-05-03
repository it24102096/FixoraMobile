// ─── User / Auth ────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'technician' | 'admin' | 'customer';
  avatarUrl?: string;
  token?: string;
  // Technician-specific fields
  workingHours?: {
    startTime: string;
    endTime: string;
  };
  availableDates?: string[];
  unavailableDates?: string[];
  specializations?: string[];
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegistrationCredentials extends AuthCredentials {
  name: string;
  phone: string;
  role?: 'customer' | 'technician' | 'admin';
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
  serviceName?: string;
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

export interface PaymentPaySlip {
  fileName?: string;
  fileUrl?: string;
  uploadedAt?: string;
}

export interface Payment {
  id: string;
  jobId: {
    _id: string;
    title: string;
    status: string;
    customerId: {
      _id: string;
      name: string;
      email: string;
      phone: string;
    }
  } | string;
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
  paySlip?: PaymentPaySlip;
  paymentNotes?: string;
  technicianEarnings?: number;
  platformFee?: number;
}

export interface PaymentLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface FinanceSummaryTotals {
  totalInvoices: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  refundedAmount: number;
  failedAmount: number;
  platformEarnings: number;
  technicianEarningsTotal: number;
}

export interface FinanceSummary {
  totals: FinanceSummaryTotals;
  statusBreakdown: Array<{
    _id: string;
    count: number;
  }>;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  basePrice: number;
  currency: string;
  estimatedDuration: number; // minutes
  icon: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Support ─────────────────────────────────────────────────────────────────

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high';

export interface TicketUserRef {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdBy: string | TicketUserRef;
  assignedTo?: string | TicketUserRef | null;
  jobId?: string | { id?: string; _id?: string; title?: string; serviceName?: string; technicianId?: string | TicketUserRef } | null;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string | TicketUserRef;
  senderName?: string;
  content: string;
  sentAt: string;
}

export type FeedbackTag =
  | 'punctual'
  | 'professional'
  | 'skilled'
  | 'friendly'
  | 'clean'
  | 'overpriced'
  | 'late';

export interface FeedbackItem {
  id: string;
  jobId: string | { _id?: string; id?: string; title?: string };
  customerId: string | TicketUserRef;
  technicianId: string | TicketUserRef;
  rating: number;
  comment?: string;
  tags: FeedbackTag[];
  createdAt: string;
  updatedAt: string;
}

export interface EligibleFeedbackJob {
  id: string;
  title: string;
  technicianId: string | TicketUserRef;
  technicianName: string;
  updatedAt: string;
  createdAt: string;
}

// ─── Leave Request ────────────────────────────────────────────────────────────────────────────────

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  technicianId: string | { _id?: string; id?: string; name?: string; email?: string };
  technicianName: string;
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  reason: string;
  status: LeaveStatus;
  adminNote?: string;
  reviewedBy?: string | { _id?: string; id?: string; name?: string } | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Navigation Params ───────────────────────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  Register: undefined;
  Home: undefined;
  EditProfile: undefined;
  TechnicianAvailability: { initialTab?: 'hours' | 'days' | 'leave' } | undefined;
  Leaves: undefined;
  Jobs: undefined;
  AddService: undefined;
  Services: undefined;
  EditService: { service: Service };
  ServiceBooking: { service: Service };
  JobDetails: { jobId: string };
  Appointment: { appointmentId?: string; jobId?: string };
  PaymentsList: undefined;
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
