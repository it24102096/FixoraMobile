import { apiService } from './api';
import {
  Appointment,
  AppointmentStatus,
  PaginatedResponse,
} from '../types';

class AppointmentService {
  async getAppointments(
    page = 1,
    limit = 20,
    status?: AppointmentStatus,
  ): Promise<PaginatedResponse<Appointment>> {
    return apiService.getPaginated<Appointment>('/appointments', page, limit, {
      params: status ? { status } : {},
    });
  }

  async getAppointmentById(id: string): Promise<Appointment> {
    const response = await apiService.get<Appointment>(`/appointments/${id}`);
    return response.data;
  }

  async getAppointmentsByJob(jobId: string): Promise<Appointment[]> {
    const response = await apiService.get<Appointment[]>(
      `/jobs/${jobId}/appointments`,
    );
    return response.data;
  }

  async createAppointment(
    payload: Partial<Appointment>,
  ): Promise<Appointment> {
    const response = await apiService.post<Appointment>(
      '/appointments',
      payload,
    );
    return response.data;
  }

  async updateAppointment(
    id: string,
    payload: Partial<Appointment>,
  ): Promise<Appointment> {
    const response = await apiService.put<Appointment>(
      `/appointments/${id}`,
      payload,
    );
    return response.data;
  }

  async cancelAppointment(id: string): Promise<void> {
    await apiService.patch(`/appointments/${id}/cancel`);
  }
}

export const appointmentService = new AppointmentService();
export default appointmentService;
