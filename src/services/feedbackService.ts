import { apiService } from './api';
import { EligibleFeedbackJob, FeedbackItem, FeedbackTag } from '../types';

export interface CreateFeedbackPayload {
  jobId: string;
  rating: number;
  comment?: string;
  tags?: FeedbackTag[];
}

const normalizeJob = (raw: any): EligibleFeedbackJob => ({
  id: raw._id || raw.id,
  title: raw.title,
  technicianId: raw.technicianId?._id || raw.technicianId || '',
  technicianName: raw.technicianId?.name || raw.technicianName || 'Technician',
  updatedAt: raw.updatedAt,
  createdAt: raw.createdAt,
});

const normalizeFeedback = (raw: any): FeedbackItem => ({
  id: raw._id || raw.id,
  jobId: raw.jobId,
  customerId: raw.customerId,
  technicianId: raw.technicianId,
  rating: raw.rating,
  comment: raw.comment,
  tags: raw.tags || [],
  createdAt: raw.createdAt,
  updatedAt: raw.updatedAt,
});

class FeedbackService {
  async createFeedback(payload: CreateFeedbackPayload): Promise<FeedbackItem> {
    const response = await apiService.post<any>('/feedback', payload);
    return normalizeFeedback(response.data);
  }

  async getMyFeedback(): Promise<FeedbackItem[]> {
    const response = await apiService.get<any>('/feedback/my');
    const items = Array.isArray(response.data) ? response.data : [];
    return items.map(normalizeFeedback);
  }

  async getEligibleJobs(): Promise<EligibleFeedbackJob[]> {
    const response = await apiService.get<any>('/feedback/eligible-jobs');
    const items = Array.isArray(response.data) ? response.data : [];
    return items.map(normalizeJob);
  }
}

export const feedbackService = new FeedbackService();
export default feedbackService;
