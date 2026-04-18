import api from './api';
import {
  Medication,
  MedicationEvent,
  MedicationEventStatus,
  MedicationSchedule,
  Visit,
  VisitCarePlanSnapshot,
} from '../types';
import { syncQueueService } from './offline';

function isLikelyOfflineError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const maybe = error as { code?: string; message?: string };
  return maybe.code === 'ECONNABORTED' || /network|timeout/i.test(maybe.message || '');
}

export const visitsService = {
  async getTodayVisits(): Promise<Visit[]> {
    const response = await api.get('/visits/today');
    return response.data;
  },

  async getVisits(params?: {
    startDate?: string;
    endDate?: string;
    status?: string;
  }): Promise<Visit[]> {
    const response = await api.get('/visits', { params });
    return response.data;
  },

  async getVisitById(id: string): Promise<Visit> {
    const response = await api.get(`/visits/${id}`);
    return response.data;
  },

  async getVisitCarePlan(visitId: string): Promise<VisitCarePlanSnapshot> {
    const response = await api.get(`/visits/${visitId}/care-plan`);
    return response.data;
  },

  async clockIn(visitId: string, latitude: number, longitude: number, lateClockInReason?: string): Promise<Visit> {
    const payload = { latitude, longitude, lateClockInReason };
    try {
      const response = await api.post(`/visits/${visitId}/clock-in`, payload);
      return response.data;
    } catch (error) {
      if (isLikelyOfflineError(error)) {
        await syncQueueService.enqueue({ method: 'POST', path: `/visits/${visitId}/clock-in`, body: payload });
      }
      throw error;
    }
  },

  async clockOut(visitId: string, latitude: number, longitude: number): Promise<Visit> {
    const payload = { latitude, longitude };
    try {
      const response = await api.post(`/visits/${visitId}/clock-out`, payload);
      return response.data;
    } catch (error) {
      if (isLikelyOfflineError(error)) {
        await syncQueueService.enqueue({ method: 'POST', path: `/visits/${visitId}/clock-out`, body: payload });
      }
      throw error;
    }
  },

  async getVisitMedications(visitId: string): Promise<(Medication & { schedules: MedicationSchedule[] })[]> {
    const response = await api.get(`/visits/${visitId}/medications`);
    return response.data;
  },

  async getDueVisitMedications(visitId: string): Promise<(Medication & { schedules: MedicationSchedule[] })[]> {
    const response = await api.get(`/visits/${visitId}/due-medications`);
    return response.data;
  },

  async createMedicationEvent(
    visitId: string,
    payload: {
      medicationId: string;
      scheduleId?: string;
      status: MedicationEventStatus;
      note?: string;
      reasonCode?: string;
      prnIndication?: string;
      dosageGiven?: string;
      signatureImage?: string;
      effectivenessNote?: string;
    }
  ): Promise<MedicationEvent> {
    try {
      const response = await api.post(`/visits/${visitId}/med-events`, payload);
      return response.data;
    } catch (error) {
      if (isLikelyOfflineError(error)) {
        await syncQueueService.enqueue({ method: 'POST', path: `/visits/${visitId}/med-events`, body: payload });
      }
      throw error;
    }
  },
};

