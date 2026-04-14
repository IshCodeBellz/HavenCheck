import api from './api';
import { ChecklistTemplate, ChecklistSubmission } from '../types';

export const checklistsService = {
  async getTemplates(clientId?: string): Promise<ChecklistTemplate[]> {
    const params = clientId ? { clientId } : {};
    const response = await api.get('/checklists/templates', { params });
    return response.data;
  },

  async getTemplateById(id: string): Promise<ChecklistTemplate> {
    const response = await api.get(`/checklists/templates/${id}`);
    return response.data;
  },

  async createTemplate(data: {
    name: string;
    description?: string;
    clientId?: string;
    items: Array<{
      label: string;
      type: 'BOOLEAN' | 'TEXT' | 'NUMBER' | 'SELECT';
      required: boolean;
      optionsJson?: string;
    }>;
  }): Promise<ChecklistTemplate> {
    const response = await api.post('/checklists/templates', data);
    return response.data;
  },

  async submitChecklist(
    visitId: string,
    templateId: string,
    items: Array<{
      checklistItemId?: string;
      valueBoolean?: boolean;
      valueText?: string;
      valueNumber?: number;
      valueOption?: string;
    }>,
    intervalIndex?: number
  ): Promise<ChecklistSubmission> {
    const response = await api.post(`/checklists/visits/${visitId}/submit`, {
      templateId,
      intervalIndex,
      items,
    });
    return response.data;
  },

  async getSubmissions(visitId: string): Promise<ChecklistSubmission[]> {
    const response = await api.get(`/checklists/visits/${visitId}/submissions`);
    return response.data;
  },
};

