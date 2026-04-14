import api from './api';
import { Note, NoteType, NotePriority } from '../types';

export const notesService = {
  async getNotes(visitId: string, type?: NoteType): Promise<Note[]> {
    const params = type ? { type } : {};
    const response = await api.get(`/notes/visits/${visitId}`, { params });
    return response.data;
  },

  async getHandoverNotes(visitId: string): Promise<Note[]> {
    const response = await api.get(`/notes/visits/${visitId}/handover`);
    return response.data;
  },

  async createNote(
    visitId: string,
    text: string,
    type: NoteType,
    priority: NotePriority = NotePriority.NORMAL
  ): Promise<Note> {
    const response = await api.post('/notes', {
      visitId,
      text,
      type,
      priority,
    });
    return response.data;
  },
};

