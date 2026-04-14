'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { authService } from '@/lib/auth';
import { isCarerLikeRole } from '@/lib/roles';
import { useSearchParams } from 'next/navigation';

interface Visit {
  id: string;
  client: { name: string; address: string };
  carer: { name: string };
  scheduledStart?: string;
  scheduledEnd?: string;
  status: string;
  clockInTime?: string;
  clockOutTime?: string;
}

function VisitsPageContent() {
  const [viewerIsCarer, setViewerIsCarer] = useState(false);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const searchParams = useSearchParams();

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

  const getDateRangeForQuickFilter = useCallback((filter: string) => {
    const now = new Date();
    let newStartDate = '';
    let newEndDate = '';

    switch (filter) {
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
      case 'last7Days':
        newStartDate = format(subDays(now, 7), 'yyyy-MM-dd');
        newEndDate = format(endOfDay(now), 'yyyy-MM-dd');
        break;
      case 'last30Days':
        newStartDate = format(subDays(now, 30), 'yyyy-MM-dd');
        newEndDate = format(endOfDay(now), 'yyyy-MM-dd');
        break;
      case 'all':
      default:
        break;
    }

    return { start: newStartDate, end: newEndDate };
  }, []);

  const loadVisits = async (customStartDate?: string, customEndDate?: string, customStatus?: string) => {
    try {
      setLoading(true);
      const params: any = {};
      const start = customStartDate !== undefined ? customStartDate : startDate;
      const end = customEndDate !== undefined ? customEndDate : endDate;
      const status = customStatus !== undefined ? customStatus : statusFilter;
      
      if (start) {
        params.startDate = toBoundaryISOString(start, 'start');
      }
      if (end) {
        params.endDate = toBoundaryISOString(end, 'end');
      }
      if (status) {
        params.status = status;
      }
      
      const response = await api.get('/visits', { params });
      setVisits(response.data);
    } catch (error) {
      console.error('Error loading visits:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const quickFilter = searchParams.get('quickFilter') || 'last7Days';
    const statusParam = searchParams.get('status') || '';
    const { start, end } = getDateRangeForQuickFilter(quickFilter);

    setStartDate(start);
    setEndDate(end);
    setStatusFilter(statusParam);
    loadVisits(start, end, statusParam);
  }, [getDateRangeForQuickFilter, searchParams]);

  const applyQuickFilter = useCallback(async (filter: string) => {
    const { start: newStartDate, end: newEndDate } = getDateRangeForQuickFilter(filter);

    setStartDate(newStartDate);
    setEndDate(newEndDate);
    await loadVisits(newStartDate, newEndDate, statusFilter);
  }, [getDateRangeForQuickFilter, statusFilter]);

  const clearFilters = async () => {
    setStartDate('');
    setEndDate('');
    setStatusFilter('');
    await loadVisits('', '', '');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS':
        return 'bg-navy-100 text-navy-800';
      case 'LATE':
        return 'bg-orange-100 text-orange-800';
      case 'MISSED':
        return 'bg-red-100 text-red-800';
      case 'INCOMPLETE':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-navy-100 text-navy-800';
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
        <h1 className="text-3xl font-bold text-navy-900 mb-6">
          {viewerIsCarer ? 'My visits' : 'Visits'}
        </h1>

        {/* Filter Controls */}
        <div className="bg-white shadow rounded-md p-4 mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="visits-filter-start" className="block text-sm font-medium text-navy-800 mb-1">
                Start Date
              </label>
              <input
                id="visits-filter-start"
                type="date"
                value={startDate}
                onChange={async (e) => {
                  const newStartDate = e.target.value;
                  setStartDate(newStartDate);
                  await loadVisits(newStartDate, endDate, statusFilter);
                }}
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="visits-filter-end" className="block text-sm font-medium text-navy-800 mb-1">
                End Date
              </label>
              <input
                id="visits-filter-end"
                type="date"
                value={endDate}
                onChange={async (e) => {
                  const newEndDate = e.target.value;
                  setEndDate(newEndDate);
                  await loadVisits(startDate, newEndDate, statusFilter);
                }}
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="visits-filter-status" className="block text-sm font-medium text-navy-800 mb-1">
                Status
              </label>
              <select
                id="visits-filter-status"
                value={statusFilter}
                onChange={async (e) => {
                  const newStatus = e.target.value;
                  setStatusFilter(newStatus);
                  await loadVisits(startDate, endDate, newStatus);
                }}
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              >
                <option value="">All Statuses</option>
                <option value="NOT_STARTED">Not Started</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="LATE">Late</option>
                <option value="COMPLETED">Completed</option>
                <option value="MISSED">Missed</option>
                <option value="INCOMPLETE">Incomplete</option>
              </select>
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
                onClick={() => applyQuickFilter('last7Days')}
                className="px-3 py-2 text-sm border border-navy-200 rounded-md hover:bg-navy-50 text-navy-800"
              >
                Last 7 Days
              </button>
              <button
                onClick={() => applyQuickFilter('last30Days')}
                className="px-3 py-2 text-sm border border-navy-200 rounded-md hover:bg-navy-50 text-navy-800"
              >
                Last 30 Days
              </button>
              {(startDate || endDate || statusFilter) && (
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

        <div className="bg-white shadow overflow-x-auto sm:rounded-md">
          <table className="w-full min-w-[980px] table-auto divide-y divide-navy-100">
            <caption className="sr-only">Visits matching the selected filters</caption>
            <thead className="bg-navy-50">
              <tr>
                <th
                  scope="col"
                  className="w-[28%] min-w-0 px-6 py-3 text-left text-xs font-medium text-navy-800/70 uppercase tracking-wider"
                >
                  Client
                </th>
                {!viewerIsCarer && (
                  <th scope="col" className="min-w-0 px-6 py-3 text-left text-xs font-medium text-navy-800/70 uppercase tracking-wider">
                    Carer
                  </th>
                )}
                <th scope="col" className="min-w-0 px-6 py-3 text-left text-xs font-medium text-navy-800/70 uppercase tracking-wider">
                  Scheduled Time
                </th>
                <th scope="col" className="min-w-0 px-6 py-3 text-left text-xs font-medium text-navy-800/70 uppercase tracking-wider">
                  Clock In
                </th>
                <th scope="col" className="min-w-0 px-6 py-3 text-left text-xs font-medium text-navy-800/70 uppercase tracking-wider">
                  Clock Out
                </th>
                <th scope="col" className="min-w-0 px-6 py-3 text-left text-xs font-medium text-navy-800/70 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="min-w-0 px-6 py-3 text-left text-xs font-medium text-navy-800/70 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-navy-100">
              {visits.map((visit) => (
                <tr key={visit.id}>
                  <td className="min-w-0 px-6 py-4 align-top wrap-break-word">
                    <div className="text-sm font-medium text-navy-900">{visit.client.name}</div>
                    <div className="text-sm text-navy-800/70">{visit.client.address}</div>
                  </td>
                  {!viewerIsCarer && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-navy-800/70">
                      {visit.carer.name}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-navy-800/70">
                    {visit.scheduledStart
                      ? format(new Date(visit.scheduledStart), 'MMM d, HH:mm')
                      : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-navy-800/70">
                    {visit.clockInTime
                      ? format(new Date(visit.clockInTime), 'MMM d, HH:mm')
                      : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-navy-800/70">
                    {visit.clockOutTime
                      ? format(new Date(visit.clockOutTime), 'MMM d, HH:mm')
                      : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                        visit.status
                      )}`}
                    >
                      {visit.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Link
                      href={`/visits/${visit.id}`}
                      className="text-navy-600 hover:text-navy-800"
                      aria-label={`View visit details for ${visit.client.name}`}
                    >
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}

export default function VisitsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-navy-50 flex items-center justify-center p-4 text-sm font-medium text-navy-800">
          <p role="status" aria-live="polite">
            Loading visits…
          </p>
        </div>
      }
    >
      <VisitsPageContent />
    </Suspense>
  );
}
