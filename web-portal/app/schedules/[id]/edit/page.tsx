'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { useRequireStaff } from '@/hooks/useRequireStaff';

interface Client {
  id: string;
  name: string;
}

interface Carer {
  id: string;
  name: string;
}

interface Schedule {
  id: string;
  clientId: string;
  carerId: string;
  startTime: string;
  endTime: string;
}

export default function EditSchedulePage() {
  const staffOk = useRequireStaff();
  const router = useRouter();
  const params = useParams();
  const scheduleId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [carers, setCarers] = useState<Carer[]>([]);
  const [formData, setFormData] = useState({
    clientId: '',
    carerId: '',
    startTime: '',
    endTime: '',
  });

  useEffect(() => {
    if (!staffOk || !scheduleId) return;
    loadSchedule();
    loadOptions();
  }, [staffOk, scheduleId]);

  const loadOptions = async () => {
    try {
      const [clientsRes, carersRes] = await Promise.all([
        api.get('/clients'),
        api.get('/users'),
      ]);
      setClients(clientsRes.data.filter((c: any) => c.active));
      setCarers(carersRes.data.filter((c: any) => c.isActive));
    } catch (error) {
      console.error('Error loading options:', error);
    }
  };

  const loadSchedule = async () => {
    try {
      const response = await api.get(`/schedules/${scheduleId}`);
      const schedule: Schedule = response.data;
      
      // Convert ISO dates to datetime-local format
      const startDate = new Date(schedule.startTime);
      const endDate = new Date(schedule.endTime);
      const startTimeLocal = new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      const endTimeLocal = new Date(endDate.getTime() - endDate.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);

      setFormData({
        clientId: schedule.clientId,
        carerId: schedule.carerId,
        startTime: startTimeLocal,
        endTime: endTimeLocal,
      });
    } catch (err: any) {
      setError('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        clientId: formData.clientId,
        carerId: formData.carerId,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
      };

      await api.patch(`/schedules/${scheduleId}`, payload);
      router.push('/schedules');
    } catch (err: any) {
      const d = err.response?.data;
      setError(d?.message || d?.error || 'Failed to update schedule');
    } finally {
      setSaving(false);
    }
  };

  if (staffOk === null || staffOk === false) {
    return (
      <Layout>
        <p role="status" aria-live="polite" className="text-navy-800">
          {staffOk === false ? 'Redirecting…' : 'Checking access…'}
        </p>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <p role="status" aria-live="polite" className="text-navy-800">
          Loading…
        </p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        <div className="mb-6">
          <Link
            href="/schedules"
            className="text-navy-600 hover:text-navy-800 mb-4 inline-block"
          >
            ← Back to Schedules
          </Link>
          <h1 className="text-3xl font-bold text-navy-900">Edit Schedule</h1>
        </div>

        {error && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-schedule-client" className="block text-sm font-medium text-navy-800 mb-1">
                Client *
              </label>
              <select
                id="edit-schedule-client"
                required
                aria-required="true"
                value={formData.clientId}
                onChange={(e) =>
                  setFormData({ ...formData, clientId: e.target.value })
                }
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              >
                <option value="">Select a client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="edit-schedule-carer" className="block text-sm font-medium text-navy-800 mb-1">
                Carer *
              </label>
              <select
                id="edit-schedule-carer"
                required
                aria-required="true"
                value={formData.carerId}
                onChange={(e) =>
                  setFormData({ ...formData, carerId: e.target.value })
                }
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              >
                <option value="">Select a carer</option>
                {carers.map((carer) => (
                  <option key={carer.id} value={carer.id}>
                    {carer.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="edit-schedule-start" className="block text-sm font-medium text-navy-800 mb-1">
                Start Time *
              </label>
              <input
                id="edit-schedule-start"
                type="datetime-local"
                required
                aria-required="true"
                value={formData.startTime}
                onChange={(e) =>
                  setFormData({ ...formData, startTime: e.target.value })
                }
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              />
            </div>

            <div>
              <label htmlFor="edit-schedule-end" className="block text-sm font-medium text-navy-800 mb-1">
                End Time *
              </label>
              <input
                id="edit-schedule-end"
                type="datetime-local"
                required
                aria-required="true"
                value={formData.endTime}
                onChange={(e) =>
                  setFormData({ ...formData, endTime: e.target.value })
                }
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <Link
              href="/schedules"
              className="px-4 py-2 border border-navy-200 rounded-md text-navy-800 hover:bg-navy-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              aria-busy={saving}
              className="px-4 py-2 bg-navy-600 text-white rounded-md hover:bg-navy-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}

