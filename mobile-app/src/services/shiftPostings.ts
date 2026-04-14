import { apiV1 } from './api';
import type { CarerOpenShiftRow, ShiftPosting } from '../types';

/** Manager and admin tokens both work on `/manager/*` v1 routes. */
const STAFF_PREFIX = '/manager';

export const shiftPostingsService = {
  async listStaff(params?: { status?: string; from?: string; to?: string }): Promise<ShiftPosting[]> {
    const res = await apiV1.get<ShiftPosting[]>(`${STAFF_PREFIX}/shift-postings`, { params });
    return res.data;
  },

  async getStaffById(id: string): Promise<ShiftPosting> {
    const res = await apiV1.get<ShiftPosting>(`${STAFF_PREFIX}/shift-postings/${id}`);
    return res.data;
  },

  async createStaff(body: {
    clientId: string;
    slotsNeeded: number;
    startTime: string;
    endTime: string;
    title?: string;
  }): Promise<ShiftPosting> {
    const res = await apiV1.post<ShiftPosting>(`${STAFF_PREFIX}/shift-postings`, body);
    return res.data;
  },

  async selectApplicants(shiftPostingId: string, applicationIds: string[]): Promise<ShiftPosting> {
    const res = await apiV1.post<ShiftPosting>(`${STAFF_PREFIX}/shift-postings/${shiftPostingId}/select`, {
      applicationIds,
    });
    return res.data;
  },

  async cancelPosting(shiftPostingId: string): Promise<ShiftPosting> {
    const res = await apiV1.post<ShiftPosting>(`${STAFF_PREFIX}/shift-postings/${shiftPostingId}/cancel`);
    return res.data;
  },

  async listOpenForCarer(): Promise<CarerOpenShiftRow[]> {
    const res = await apiV1.get<CarerOpenShiftRow[]>('/carer/open-shifts');
    return res.data;
  },

  async applyForShift(shiftPostingId: string): Promise<unknown> {
    const res = await apiV1.post(`/carer/open-shifts/${shiftPostingId}/apply`);
    return res.data;
  },

  async withdrawApplication(applicationId: string): Promise<unknown> {
    const res = await apiV1.post(`/carer/open-shifts/applications/${applicationId}/withdraw`);
    return res.data;
  },
};
