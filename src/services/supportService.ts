import { apiService } from './api';
import {
  SupportTicket,
  TicketStatus,
  TicketMessage,
  PaginatedResponse,
} from '../types';

class SupportService {
  async getTickets(
    page = 1,
    limit = 20,
    status?: TicketStatus,
  ): Promise<PaginatedResponse<SupportTicket>> {
    return apiService.getPaginated<SupportTicket>('/support/tickets', page, limit, {
      params: status ? { status } : {},
    });
  }

  async getTicketById(id: string): Promise<SupportTicket> {
    const response = await apiService.get<SupportTicket>(
      `/support/tickets/${id}`,
    );
    return response.data;
  }

  async createTicket(
    payload: Pick<SupportTicket, 'subject' | 'description' | 'priority'>,
  ): Promise<SupportTicket> {
    const response = await apiService.post<SupportTicket>(
      '/support/tickets',
      payload,
    );
    return response.data;
  }

  async sendMessage(ticketId: string, content: string): Promise<TicketMessage> {
    const response = await apiService.post<TicketMessage>(
      `/support/tickets/${ticketId}/messages`,
      { content },
    );
    return response.data;
  }

  async closeTicket(ticketId: string): Promise<SupportTicket> {
    const response = await apiService.patch<SupportTicket>(
      `/support/tickets/${ticketId}/close`,
    );
    return response.data;
  }
}

export const supportService = new SupportService();
export default supportService;
