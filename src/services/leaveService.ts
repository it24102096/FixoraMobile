import { apiService } from './api';
import { LeaveRequest, LeaveStatus } from '../types';

class LeaveService {
  async applyLeave(payload: {
    startDate: string;
    endDate: string;
    reason: string;
  }): Promise<LeaveRequest> {
    const response = await apiService.post<LeaveRequest>('/leaves', payload);
    return response.data;
  }

  async getLeaves(status?: LeaveStatus): Promise<LeaveRequest[]> {
    const params = status ? { status } : {};
    const response = await apiService.get<LeaveRequest[]>('/leaves', { params });
    return response.data;
  }

  async approveLeave(id: string, adminNote?: string): Promise<LeaveRequest> {
    const response = await apiService.patch<LeaveRequest>(
      `/leaves/${id}/approve`,
      { adminNote: adminNote || '' },
    );
    return response.data;
  }

  async rejectLeave(id: string, adminNote?: string): Promise<LeaveRequest> {
    const response = await apiService.patch<LeaveRequest>(
      `/leaves/${id}/reject`,
      { adminNote: adminNote || '' },
    );
    return response.data;
  }

  async cancelLeave(id: string): Promise<void> {
    await apiService.delete(`/leaves/${id}`);
  }
}

export const leaveService = new LeaveService();
export default leaveService;
