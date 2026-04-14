'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

export default function NewSchedulePage() {
  const staffOk = useRequireStaff();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
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
    if (staffOk) loadOptions();
  }, [staffOk]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Check availability first
      if (formData.carerId && formData.startTime && formData.endTime) {
        try {
          const availabilityCheck = await api.get('/availability/check', {
            params: {
              carerId: formData.carerId,
              startTime: new Date(formData.startTime).toISOString(),
              endTime: new Date(formData.endTime).toISOString(),
            },
          });

          const ok =
            availabilityCheck.data.canSchedule ?? availabilityCheck.data.isAvailable;
          if (!ok) {
            setError(
              availabilityCheck.data.message ||
                'This carer has not recorded availability that fully covers this shift (or is marked unavailable).'
            );
            setLoading(false);
            return;
          }
        } catch (checkErr: any) {
          // If check fails, proceed anyway (might be a network issue)
          console.warn('Availability check failed:', checkErr);
        }
      }

      const payload = {
        clientId: formData.clientId,
        carerId: formData.carerId,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
      };

      await api.post('/schedules', payload);
      router.push('/schedules');
    } catch (err: any) {
      const d = err.response?.data;
      setError(d?.message || d?.error || 'Failed to create schedule');
    } finally {
      setLoading(false);
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
          <h1 className="text-3xl font-bold text-navy-900">New Schedule</h1>
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
              <label htmlFor="new-schedule-client" className="block text-sm font-medium text-navy-800 mb-1">
                Client *
              </label>
              <select
                id="new-schedule-client"
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
              <label htmlFor="new-schedule-carer" className="block text-sm font-medium text-navy-800 mb-1">
                Carer *
              </label>
              <select
                id="new-schedule-carer"
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
              <label htmlFor="new-schedule-start" className="block text-sm font-medium text-navy-800 mb-1">
                Start Time *
              </label>
              <input
                id="new-schedule-start"
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
              <label htmlFor="new-schedule-end" className="block text-sm font-medium text-navy-800 mb-1">
                End Time *
              </label>
              <input
                id="new-schedule-end"
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
              disabled={loading}
              aria-busy={loading}
              className="px-4 py-2 bg-navy-600 text-white rounded-md hover:bg-navy-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Schedule'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}

