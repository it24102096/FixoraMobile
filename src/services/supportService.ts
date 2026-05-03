import { apiService } from './api';
import {
  SupportTicket,
  TicketStatus,
  TicketMessage,
  PaginatedResponse,
} from '../types';

const normalizeMessage = (message: any, ticketId: string): TicketMessage => ({
  id: message?.id || message?._id || `${Date.now()}`,
  ticketId,
  senderId: message?.senderId || '',
  senderName:
    message?.senderName ||
    message?.senderId?.name ||
    'User',
  content: message?.content || '',
  sentAt: message?.sentAt || new Date().toISOString(),
});

const normalizeTicket = (ticket: any): SupportTicket => ({
  id: ticket?.id || ticket?._id || '',
  subject: ticket?.subject || '',
  description: ticket?.description || '',
  status: ticket?.status || 'open',
  priority: ticket?.priority || 'medium',
  createdBy: ticket?.createdBy || '',
  assignedTo: ticket?.assignedTo || null,
  jobId: ticket?.jobId || null,
  createdAt: ticket?.createdAt || new Date().toISOString(),
  updatedAt: ticket?.updatedAt || new Date().toISOString(),
  messages: Array.isArray(ticket?.messages)
    ? ticket.messages.map((m: any) => normalizeMessage(m, ticket?.id || ticket?._id || ''))
    : [],
});

class SupportService {
  async getTickets(
    page = 1,
    limit = 20,
    status?: TicketStatus,
    search?: string,
  ): Promise<PaginatedResponse<SupportTicket>> {
    const raw = await apiService.getPaginated<any>('/support/tickets', page, limit, {
      params: {
        ...(status ? { status } : {}),
        ...(search ? { search } : {}),
      },
    });

    return {
      ...raw,
      data: (raw.data || []).map((ticket: any) => normalizeTicket(ticket)),
    } as PaginatedResponse<SupportTicket>;
  }

  async getTicketById(id: string): Promise<SupportTicket> {
    const response = await apiService.get<any>(
      `/support/tickets/${id}`,
    );
    return normalizeTicket(response.data);
  }

  async createTicket(
    payload: Pick<SupportTicket, 'subject' | 'description' | 'priority'> & { jobId?: string },
  ): Promise<SupportTicket> {
    const response = await apiService.post<any>(
      '/support/tickets',
      payload,
    );
    return normalizeTicket(response.data);
  }

  async updateTicket(
    ticketId: string,
    payload: Pick<SupportTicket, 'subject' | 'description' | 'priority'>,
  ): Promise<SupportTicket> {
    const response = await apiService.put<any>(
      `/support/tickets/${ticketId}`,
      payload,
    );
    return normalizeTicket(response.data);
  }

  async updateTicketStatus(
    ticketId: string,
    status: TicketStatus,
  ): Promise<SupportTicket> {
    const response = await apiService.patch<any>(
      `/support/tickets/${ticketId}/status`,
      { status },
    );
    return normalizeTicket(response.data);
  }

  async sendMessage(ticketId: string, content: string): Promise<TicketMessage> {
    const response = await apiService.post<any>(
      `/support/tickets/${ticketId}/messages`,
      { content },
    );
    return normalizeMessage(response.data, ticketId);
  }

  async closeTicket(ticketId: string): Promise<SupportTicket> {
    const response = await apiService.patch<any>(
      `/support/tickets/${ticketId}/close`,
    );
    return normalizeTicket(response.data);
  }
}

export const supportService = new SupportService();
export default supportService;
