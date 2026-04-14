import api from "./api";

export interface Availability {
  id: string;
  carerId: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export const availabilityService = {
  async getAvailability(
    startDate?: string,
    endDate?: string,
    carerId?: string
  ): Promise<Availability[]> {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (carerId) params.carerId = carerId;

    // Use general availability endpoint if carerId is provided (for admins/managers)
    // Otherwise use carer endpoint for own availability
    const endpoint = carerId ? "/availability" : "/carer/availability";
    const response = await api.get(endpoint, { params });
    return response.data;
  },

  async createAvailability(
    startTime: string,
    endTime: string,
    isAvailable: boolean = false,
    carerId?: string
  ): Promise<Availability> {
    const endpoint = carerId ? "/availability" : "/carer/availability";
    const body: any = {
      startTime,
      endTime,
      isAvailable,
    };
    if (carerId) body.carerId = carerId;

    const response = await api.post(endpoint, body);
    return response.data;
  },

  async updateAvailability(
    id: string,
    data: {
      startTime?: string;
      endTime?: string;
      isAvailable?: boolean;
    },
    carerId?: string
  ): Promise<Availability> {
    // Use general availability endpoint if carerId is provided (for admins/managers)
    const endpoint = carerId ? "/availability" : "/carer/availability";
    const response = await api.put(`${endpoint}/${id}`, data);
    return response.data;
  },

  async deleteAvailability(id: string, carerId?: string): Promise<void> {
    // Use general availability endpoint if carerId is provided (for admins/managers)
    const endpoint = carerId ? "/availability" : "/carer/availability";
    await api.delete(`${endpoint}/${id}`);
  },
};
