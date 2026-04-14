'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { authService } from '@/lib/auth';
import { isCarerLikeRole } from '@/lib/roles';

interface Schedule {
  id: string;
  client: { name: string };
  carer: { name: string };
  startTime: string;
  endTime: string;
}

export default function SchedulesPage() {
  const [viewerIsCarer, setViewerIsCarer] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const toBoundaryISOString = (date: string, boundary: 'start' | 'end') => {
    const [year, month, day] = date.split('-').map(Number);
    const localDate = new Date(
      year,
      month - 1,
      day,
      boundary === 'start' ? 0 : 23,
      boundary === 'start' ? 0 : 59,
      boundary === 'start' ? 0 : 59,
      boundary === 'start' ? 0 : 999
    );
    return localDate.toISOString();
  };

  useEffect(() => {
    authService.getCurrentUser().then((u) => setViewerIsCarer(isCarerLikeRole(u?.role)));
  }, []);

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async (customStartDate?: string, customEndDate?: string) => {
    try {
      const params: any = {};
      const start = customStartDate !== undefined ? customStartDate : startDate;
      const end = customEndDate !== undefined ? customEndDate : endDate;
      
      if (start) {
        params.startDate = toBoundaryISOString(start, 'start');
      }
      if (end) {
        params.endDate = toBoundaryISOString(end, 'end');
      }
      
      const response = await api.get('/schedules', { params });
      setSchedules(response.data);
    } catch (error) {
      console.error('Error loading schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyQuickFilter = async (filter: string) => {
    const now = new Date();
    let newStartDate = '';
    let newEndDate = '';

    switch (filter) {
      case 'all':
        newStartDate = '';
        newEndDate = '';
        break;
      case 'today':
        newStartDate = format(startOfDay(now), 'yyyy-MM-dd');
        newEndDate = format(endOfDay(now), 'yyyy-MM-dd');
        break;
      case 'thisWeek':
        newStartDate = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        newEndDate = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        break;
      case 'thisMonth':
        newStartDate = format(startOfMonth(now), 'yyyy-MM-dd');
        newEndDate = format(endOfMonth(now), 'yyyy-MM-dd');
        break;
      case 'future':
        newStartDate = format(startOfDay(now), 'yyyy-MM-dd');
        newEndDate = '';
        break;
    }

    setStartDate(newStartDate);
    setEndDate(newEndDate);
    
    // Load schedules with new filter
    setLoading(true);
    await loadSchedules(newStartDate, newEndDate);
  };


  const clearFilters = async () => {
    setStartDate('');
    setEndDate('');
    setLoading(true);
    await loadSchedules('', '');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) {
      return;
    }

    setDeletingId(id);
    try {
      await api.delete(`/schedules/${id}`);
      await loadSchedules();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete schedule');
    } finally {
      setDeletingId(null);
    }
  };

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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-navy-900">
            {viewerIsCarer ? 'My roster' : 'Schedules'}
          </h1>
          {!viewerIsCarer && (
            <Link
              href="/schedules/new"
              className="bg-navy-600 text-white px-4 py-2 rounded-md hover:bg-navy-700"
            >
              Add Schedule
            </Link>
          )}
        </div>

        {/* Filter Controls */}
        <div className="bg-white shadow rounded-md p-4 mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="schedules-filter-start" className="block text-sm font-medium text-navy-800 mb-1">
                Start Date
              </label>
              <input
                id="schedules-filter-start"
                type="date"
                value={startDate}
                onChange={async (e) => {
                  const newStartDate = e.target.value;
                  setStartDate(newStartDate);
                  setLoading(true);
                  await loadSchedules(newStartDate, endDate);
                }}
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="schedules-filter-end" className="block text-sm font-medium text-navy-800 mb-1">
                End Date
              </label>
              <input
                id="schedules-filter-end"
                type="date"
                value={endDate}
                onChange={async (e) => {
                  const newEndDate = e.target.value;
                  setEndDate(newEndDate);
                  setLoading(true);
                  await loadSchedules(startDate, newEndDate);
                }}
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => applyQuickFilter('all')}
                className="px-3 py-2 text-sm border border-navy-200 rounded-md hover:bg-navy-50 text-navy-800"
              >
                All
              </button>
              <button
                onClick={() => applyQuickFilter('today')}
                className="px-3 py-2 text-sm border border-navy-200 rounded-md hover:bg-navy-50 text-navy-800"
              >
                Today
              </button>
              <button
                onClick={() => applyQuickFilter('thisWeek')}
                className="px-3 py-2 text-sm border border-navy-200 rounded-md hover:bg-navy-50 text-navy-800"
              >
                This Week
              </button>
              <button
                onClick={() => applyQuickFilter('thisMonth')}
                className="px-3 py-2 text-sm border border-navy-200 rounded-md hover:bg-navy-50 text-navy-800"
              >
                This Month
              </button>
              <button
                onClick={() => applyQuickFilter('future')}
                className="px-3 py-2 text-sm border border-navy-200 rounded-md hover:bg-navy-50 text-navy-800"
              >
                Future
              </button>
              {(startDate || endDate) && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-2 text-sm bg-navy-100 border border-navy-200 rounded-md hover:bg-navy-100 text-navy-800"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <table className="min-w-full divide-y divide-navy-100">
            <caption className="sr-only">Scheduled visits</caption>
            <thead className="bg-navy-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-navy-800/70 uppercase tracking-wider">
                  Client
                </th>
                {!viewerIsCarer && (
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-navy-800/70 uppercase tracking-wider">
                    Carer
                  </th>
                )}
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-navy-800/70 uppercase tracking-wider">
                  Start Time
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-navy-800/70 uppercase tracking-wider">
                  End Time
                </th>
                {!viewerIsCarer && (
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-navy-800/70 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-navy-100">
              {schedules.map((schedule) => (
                <tr key={schedule.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-navy-900">
                    {schedule.client.name}
                  </td>
                  {!viewerIsCarer && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-navy-800/70">
                      {schedule.carer.name}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-navy-800/70">
                    {format(new Date(schedule.startTime), 'MMM d, yyyy HH:mm')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-navy-800/70">
                    {format(new Date(schedule.endTime), 'MMM d, yyyy HH:mm')}
                  </td>
                  {!viewerIsCarer && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-3">
                        <Link
                          href={`/schedules/${schedule.id}/edit`}
                          className="text-navy-600 hover:text-navy-800"
                          aria-label={`Edit schedule for ${schedule.client.name}`}
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(schedule.id)}
                          disabled={deletingId === schedule.id}
                          className="text-red-600 hover:text-red-800 disabled:opacity-50"
                          aria-label={`Delete schedule for ${schedule.client.name}`}
                        >
                          {deletingId === schedule.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}

