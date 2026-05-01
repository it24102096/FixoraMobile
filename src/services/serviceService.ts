import { apiService } from './api';

export interface CreateServicePayload {
  name: string;
  description: string;
  category: string;
  basePrice: number;
  currency?: string;
  estimatedDuration: number;
  icon?: string;
}

export interface UpdateServicePayload extends Partial<CreateServicePayload> {
  isActive?: boolean;
}

export interface BookServicePayload {
  serviceId: string;
  address: string;
  scheduledAt: string; // ISO date string
  notes?: string;
}

class ServiceService {
  async getServices(category?: string) {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    const response = await apiService.get(`/services${params}`);
    return (response as any).data as any[];
  }

  async getServiceById(id: string) {
    const response = await apiService.get(`/services/${id}`);
    return (response as any).data;
  }

  async getCategories(): Promise<string[]> {
    const response = await apiService.get('/services/categories');
    return (response as any).data as string[];
  }

  async createService(payload: CreateServicePayload) {
    const response = await apiService.post('/services', payload);
    return (response as any).data;
  }

  async updateService(id: string, payload: UpdateServicePayload) {
    const response = await apiService.put(`/services/${id}`, payload);
    return (response as any).data;
  }

  async deleteService(id: string) {
    const response = await apiService.delete(`/services/${id}`);
    return response;
  }

  async bookService(payload: BookServicePayload) {
    const response = await apiService.post('/jobs/book', payload);
    return (response as any).data as { job: any; payment: any };
  }
}

export const serviceService = new ServiceService();
export default serviceService;
