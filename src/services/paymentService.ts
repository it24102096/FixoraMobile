import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './api';
import { API_BASE_URL } from '../config/env';
import { FinanceSummary, Payment, PaymentMethod, PaginatedResponse } from '../types';

interface PaySlipFile {
  uri: string;
  name: string;
  type: string;
  size: number;
  base64?: string;
}

const buildSlipFormData = (paySlip: PaySlipFile, notes: string): FormData => {
  const formData = new FormData();

  // React Native Android uploads can fail when uri is missing a scheme.
  const normalizedUri =
    paySlip.uri.startsWith('file://') || paySlip.uri.startsWith('content://')
      ? paySlip.uri
      : `file://${paySlip.uri}`;

  const safeName = paySlip.name?.trim() || `slip_${Date.now()}.jpg`;
  const safeType = paySlip.type?.trim() || 'image/jpeg';

  formData.append('paySlip', {
    uri: normalizedUri,
    type: safeType,
    name: safeName,
  } as any);
  formData.append('notes', notes);

  return formData;
};

class PaymentService {
  async uploadPaySlipInline(paymentId: string, paySlip: PaySlipFile, notes: string): Promise<Payment> {
    if (!paySlip.base64) {
      throw new Error('No inline slip data available');
    }

    const response = await apiService.post<Payment>(
      `/payments/${paymentId}/upload-slip-inline`,
      {
        notes,
        fileName: paySlip.name,
        mimeType: paySlip.type,
        base64Data: paySlip.base64,
      },
    );
    return response.data;
  }

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
    const uploadUrl = `${API_BASE_URL}/payments/${paymentId}/upload-slip`;
    const token = await AsyncStorage.getItem('auth_token');
    const executeUpload = async (): Promise<Payment> => {
      const formData = buildSlipFormData(paySlip, notes);

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          // Do NOT set Content-Type — fetch sets boundary for multipart.
        },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        const err: any = new Error(json?.message || 'Upload failed');
        err.response = { data: json };
        throw err;
      }
      return json.data as Payment;
    };

    try {
      return await executeUpload();
    } catch (err: any) {
      const msg = String(err?.message || '').toLowerCase();
      // Fallback for Android URI upload issues: send inline base64 payload.
      if ((msg.includes('network request failed') || msg.includes('network error')) && paySlip.base64) {
        return this.uploadPaySlipInline(paymentId, paySlip, notes);
      }

      // Retry once for transient transport failures on emulator/mobile network.
      if (msg.includes('network request failed') || msg.includes('network error')) {
        return executeUpload();
      }
      throw err;
    }
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

  async deletePayment(paymentId: string): Promise<void> {
    await apiService.delete(`/payments/${paymentId}`);
  }

  async confirmPaySlip(paymentId: string, approve: boolean, note: string): Promise<Payment> {
    const response = await apiService.post<Payment>(
      `/payments/${paymentId}/confirm-slip`,
      { approve, note },
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
