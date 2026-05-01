import { apiService } from './api';
import { FinanceSummary, Payment, PaymentMethod, PaginatedResponse } from '../types';

interface PaySlipFile {
  uri: string;
  name: string;
  type: string;
  size: number;
}

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

  async uploadPaySlip(paymentId: string, paySlip: PaySlipFile, notes: string): Promise<Payment> {
    const formData = new FormData();
    
    // Append file in React Native compatible format
    formData.append('paySlip', {
      uri: paySlip.uri,
      type: paySlip.type,
      name: paySlip.name,
    } as any);
    formData.append('notes', notes);

    // Let Axios handle the Content-Type header automatically
    const response = await apiService.post<Payment>(
      `/payments/${paymentId}/upload-slip`,
      formData,
    );
    return response.data;
  }

  async processPayment(
    paymentId: string,
    method: PaymentMethod,
    paySlip?: PaySlipFile,
    notes?: string,
  ): Promise<Payment> {
    if (method === 'bank_transfer' && paySlip && notes) {
      return this.uploadPaySlip(paymentId, paySlip, notes);
    }

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

  async getFinanceSummary(): Promise<FinanceSummary> {
    const response = await apiService.get<FinanceSummary>('/payments/finance-summary');
    return response.data;
  }
}

export const paymentService = new PaymentService();
export default paymentService;
