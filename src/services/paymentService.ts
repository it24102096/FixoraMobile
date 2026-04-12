import { apiService } from './api';
import { Payment, PaymentMethod, PaginatedResponse } from '../types';

class PaymentService {
  async getPayments(page = 1, limit = 20): Promise<PaginatedResponse<Payment>> {
    return apiService.getPaginated<Payment>('/payments', page, limit);
  }

  async getPaymentById(id: string): Promise<Payment> {
    const response = await apiService.get<Payment>(`/payments/${id}`);
    return response.data;
  }

  async getPaymentByJob(jobId: string): Promise<Payment> {
    const response = await apiService.get<Payment>(`/jobs/${jobId}/payment`);
    return response.data;
  }

  async createInvoice(jobId: string): Promise<Payment> {
    const response = await apiService.post<Payment>('/payments', { jobId });
    return response.data;
  }

  async processPayment(
    paymentId: string,
    method: PaymentMethod,
  ): Promise<Payment> {
    const response = await apiService.post<Payment>(
      `/payments/${paymentId}/process`,
      { method },
    );
    return response.data;
  }

  async refundPayment(paymentId: string, reason: string): Promise<Payment> {
    const response = await apiService.post<Payment>(
      `/payments/${paymentId}/refund`,
      { reason },
    );
    return response.data;
  }

  async downloadInvoice(paymentId: string): Promise<string> {
    // Returns a temporary download URL
    const response = await apiService.get<string>(
      `/payments/${paymentId}/invoice`,
    );
    return response.data;
  }
}

export const paymentService = new PaymentService();
export default paymentService;
