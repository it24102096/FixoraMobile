import { apiService } from './api';
import { Job, JobStatus, PaginatedResponse } from '../types';

class JobService {
  // ─── Fetch ────────────────────────────────────────────────────────────────

  async getJobs(
    page = 1,
    limit = 20,
    status?: JobStatus,
  ): Promise<PaginatedResponse<Job>> {
    return apiService.getPaginated<Job>('/jobs', page, limit, {
      params: status ? { status } : {},
    });
  }

  async getJobById(jobId: string): Promise<Job> {
    const response = await apiService.get<Job>(`/jobs/${jobId}`);
    return response.data;
  }

  // ─── Create / Update ──────────────────────────────────────────────────────

  async createJob(payload: Partial<Job>): Promise<Job> {
    const response = await apiService.post<Job>('/jobs', payload);
    return response.data;
  }

  async updateJob(jobId: string, payload: Partial<Job>): Promise<Job> {
    const response = await apiService.put<Job>(`/jobs/${jobId}`, payload);
    return response.data;
  }

  async updateJobStatus(jobId: string, status: JobStatus): Promise<Job> {
    const response = await apiService.patch<Job>(`/jobs/${jobId}/status`, {
      status,
    });
    return response.data;
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async deleteJob(jobId: string): Promise<void> {
    await apiService.delete(`/jobs/${jobId}`);
  }

  // ─── Assignment ───────────────────────────────────────────────────────────
  async getAvailableTechnicians(scheduledAt: string, duration: number = 60, serviceName?: string): Promise<any[]> {
    const response = await apiService.get('/jobs/available-technicians', {
      params: { scheduledAt, duration, ...(serviceName ? { serviceName } : {}) },
    });
    return ((response as any).data as any[]) || [];
  }
  async assignTechnician(jobId: string, technicianId: string): Promise<Job> {
    const response = await apiService.patch<Job>(`/jobs/${jobId}/assign`, {
      technicianId,
    });
    return (response as any).data?.data || (response as any).data;
  }
}

export const jobService = new JobService();
export default jobService;
