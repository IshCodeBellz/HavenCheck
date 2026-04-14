'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { authService, User } from '@/lib/auth';
import Layout from '@/components/Layout';
import { format } from 'date-fns';
import { isStaff } from '@/lib/roles';

type Tab = 'my' | 'staff';

interface Carer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
}

interface Availability {
  id: string;
  carerId: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AvailabilityPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('my');
  const [carers, setCarers] = useState<Carer[]>([]);
  const [selectedCarerId, setSelectedCarerId] = useState<string>('all');
  const [myAvailability, setMyAvailability] = useState<Availability[]>([]);
  const [staffAvailability, setStaffAvailability] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMyAvailability, setLoadingMyAvailability] = useState(false);
  const [loadingStaffAvailability, setLoadingStaffAvailability] = useState(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockKind, setBlockKind] = useState<'unavailable' | 'available'>('unavailable');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editKind, setEditKind] = useState<'unavailable' | 'available'>('unavailable');
  const [updating, setUpdating] = useState(false);

  const staffUser = currentUser ? isStaff(currentUser) : false;

  useEffect(() => {
    const user = authService.getStoredUser();
    setCurrentUser(user);
    if (user && isStaff(user)) {
      void loadCarers();
    } else {
      setLoading(false);
    }
    const today = new Date();
    const fourWeeksLater = new Date();
    fourWeeksLater.setDate(fourWeeksLater.getDate() + 28);
    setStartDate(today.toISOString().split('T')[0]);
    setEndDate(fourWeeksLater.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (currentUser && !staffUser && activeTab === 'staff') {
      setActiveTab('my');
    }
  }, [currentUser, staffUser, activeTab]);

  useEffect(() => {
    if (activeTab === 'my' && currentUser && startDate && endDate) {
      void loadMyAvailability();
    } else if (
      staffUser &&
      activeTab === 'staff' &&
      selectedCarerId &&
      startDate &&
      endDate &&
      carers.length > 0
    ) {
      void loadStaffAvailability();
    }
  }, [activeTab, selectedCarerId, startDate, endDate, carers.length, currentUser, staffUser]);

  const loadCarers = async () => {
    try {
      const response = await api.get('/users/staff');
      setCarers(response.data as Carer[]);
    } catch (error) {
      console.error('Error loading staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMyAvailability = async () => {
    if (!currentUser?.id) return;
    try {
      setLoadingMyAvailability(true);
      const response = await api.get('/availability', {
        params: {
          carerId: currentUser.id,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
        },
      });
      setMyAvailability(response.data);
    } catch (error) {
      console.error('Error loading my availability:', error);
    } finally {
      setLoadingMyAvailability(false);
    }
  };

  const loadStaffAvailability = async () => {
    if (selectedCarerId === 'all') {
      setLoadingStaffAvailability(true);
      try {
        const allAvailability: Availability[] = [];
        const staffToLoad = carers.length > 0 ? carers : await loadStaffForAvailability();
        for (const staffMember of staffToLoad) {
          try {
            const response = await api.get('/availability', {
              params: {
                carerId: staffMember.id,
                startDate: new Date(startDate).toISOString(),
                endDate: new Date(endDate).toISOString(),
              },
            });
            allAvailability.push(...response.data);
          } catch (error) {
            console.error(`Error loading availability for staff ${staffMember.id}:`, error);
          }
        }
        setStaffAvailability(allAvailability);
      } catch (error) {
        console.error('Error loading staff availability:', error);
      } finally {
        setLoadingStaffAvailability(false);
      }
    } else {
      setLoadingStaffAvailability(true);
      try {
        const response = await api.get('/availability', {
          params: {
            carerId: selectedCarerId,
            startDate: new Date(startDate).toISOString(),
            endDate: new Date(endDate).toISOString(),
          },
        });
        setStaffAvailability(response.data);
      } catch (error) {
        console.error('Error loading staff availability:', error);
      } finally {
        setLoadingStaffAvailability(false);
      }
    }
  };

  const loadStaffForAvailability = async (): Promise<Carer[]> => {
    try {
      const response = await api.get('/users/staff');
      return response.data as Carer[];
    } catch (error) {
      console.error('Error loading staff:', error);
      return [];
    }
  };

  const getStaffName = (carerId: string) => {
    const staffMember = carers.find((c) => c.id === carerId);
    return staffMember ? staffMember.name : 'Unknown';
  };

  const addMyPeriod = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setFormError(null);
    const start = new Date(blockStart);
    const end = new Date(blockEnd);
    if (!blockStart || !blockEnd) {
      setFormError('Choose a start and end date and time.');
      return;
    }
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setFormError('Those dates are not valid.');
      return;
    }
    if (end.getTime() <= start.getTime()) {
      setFormError('End must be after start.');
      return;
    }
    try {
      setSubmitting(true);
      await api.post('/availability', {
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        isAvailable: blockKind === 'available',
      });
      setBlockStart('');
      setBlockEnd('');
      await loadMyAvailability();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setFormError(msg || 'Could not save this period. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const removeMyPeriod = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Remove this period from your calendar?')) return;
    try {
      await api.delete(`/availability/${id}`);
      await loadMyAvailability();
    } catch (error) {
      console.error('Error removing availability:', error);
    }
  };

  const toLocalDateTimeValue = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const beginEditMyPeriod = (item: Availability) => {
    setEditingPeriodId(item.id);
    setEditStart(toLocalDateTimeValue(item.startTime));
    setEditEnd(toLocalDateTimeValue(item.endTime));
    setEditKind(item.isAvailable ? 'available' : 'unavailable');
    setFormError(null);
  };

  const cancelEditMyPeriod = () => {
    setEditingPeriodId(null);
    setEditStart('');
    setEditEnd('');
  };

  const saveEditMyPeriod = async () => {
    if (!editingPeriodId) return;
    const start = new Date(editStart);
    const end = new Date(editEnd);
    if (!editStart || !editEnd) {
      setFormError('Choose a start and end date and time.');
      return;
    }
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setFormError('Those dates are not valid.');
      return;
    }
    if (end.getTime() <= start.getTime()) {
      setFormError('End must be after start.');
      return;
    }

    setUpdating(true);
    setFormError(null);
    try {
      await api.put(`/availability/${editingPeriodId}`, {
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        isAvailable: editKind === 'available',
      });
      await loadMyAvailability();
      cancelEditMyPeriod();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setFormError(msg || 'Could not update this period. Try again.');
    } finally {
      setUpdating(false);
    }
  };

  const staffUnavailability = staffAvailability.filter((a) => !a.isAvailable);
  const currentStaffRows = staffUnavailability;

  const rowDuration = (start: Date, end: Date) => {
    const durationMs = end.getTime() - start.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
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
        <h1 className="text-3xl font-bold text-navy-900 mb-2">Availability</h1>
        {!staffUser && (
          <p className="text-navy-800/80 mb-6 max-w-2xl">
            Set when you are <strong className="font-medium text-navy-900">not available</strong> (time off)
            or add windows when you <strong className="font-medium text-navy-900">are available</strong>. Only
            you can edit your own calendar.
          </p>
        )}

        {staffUser && (
          <div className="bg-white shadow rounded-lg p-4 mb-6">
            <div
              role="tablist"
              aria-label="Availability view"
              className="flex space-x-4 border-b border-navy-100"
            >
              <button
                type="button"
                role="tab"
                id="availability-tab-my"
                aria-selected={activeTab === 'my'}
                aria-controls="availability-tabpanel"
                onClick={() => setActiveTab('my')}
                className={`px-4 py-2 font-medium text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 rounded-t ${
                  activeTab === 'my'
                    ? 'text-navy-600 border-b-2 border-navy-600'
                    : 'text-navy-800/70 hover:text-navy-800'
                }`}
              >
                My calendar
              </button>
              <button
                type="button"
                role="tab"
                id="availability-tab-staff"
                aria-selected={activeTab === 'staff'}
                aria-controls="availability-tabpanel"
                onClick={() => setActiveTab('staff')}
                className={`px-4 py-2 font-medium text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 rounded-t ${
                  activeTab === 'staff'
                    ? 'text-navy-600 border-b-2 border-navy-600'
                    : 'text-navy-800/70 hover:text-navy-800'
                }`}
              >
                Staff availability
              </button>
            </div>
          </div>
        )}

        <div
          id="availability-tabpanel"
          role="tabpanel"
          aria-labelledby={
            staffUser
              ? activeTab === 'my'
                ? 'availability-tab-my'
                : 'availability-tab-staff'
              : 'availability-heading-self'
          }
          aria-label={staffUser ? undefined : 'My availability'}
          className="space-y-6"
        >
          {!staffUser && (
            <h2 id="availability-heading-self" className="sr-only">
              My availability
            </h2>
          )}

          {activeTab === 'my' && (
            <div className="bg-white shadow rounded-lg p-6 border border-navy-100">
              <h2 className="text-lg font-medium text-navy-900 mb-4">Add a period</h2>
              <form onSubmit={addMyPeriod} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="availability-block-start" className="block text-sm font-medium text-navy-800 mb-1">
                      Starts
                    </label>
                    <input
                      id="availability-block-start"
                      type="datetime-local"
                      value={blockStart}
                      onChange={(e) => setBlockStart(e.target.value)}
                      className="w-full px-3 py-2 border border-navy-200 rounded-md shadow-sm focus:outline-none focus:ring-navy-600 focus:border-navy-600"
                    />
                  </div>
                  <div>
                    <label htmlFor="availability-block-end" className="block text-sm font-medium text-navy-800 mb-1">
                      Ends
                    </label>
                    <input
                      id="availability-block-end"
                      type="datetime-local"
                      value={blockEnd}
                      onChange={(e) => setBlockEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-navy-200 rounded-md shadow-sm focus:outline-none focus:ring-navy-600 focus:border-navy-600"
                    />
                  </div>
                </div>
                <div>
                  <span className="block text-sm font-medium text-navy-800 mb-2">Meaning</span>
                  <div className="flex flex-wrap gap-4">
                    <label className="inline-flex items-center gap-2 text-sm text-navy-800 cursor-pointer">
                      <input
                        type="radio"
                        name="blockKind"
                        checked={blockKind === 'unavailable'}
                        onChange={() => setBlockKind('unavailable')}
                        className="text-navy-600 focus:ring-navy-600"
                      />
                      Not available (time off / cannot be scheduled)
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-navy-800 cursor-pointer">
                      <input
                        type="radio"
                        name="blockKind"
                        checked={blockKind === 'available'}
                        onChange={() => setBlockKind('available')}
                        className="text-navy-600 focus:ring-navy-600"
                      />
                      Available (optional note for scheduling)
                    </label>
                  </div>
                </div>
                {formError && (
                  <p className="text-sm text-red-700" role="alert">
                    {formError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-navy-600 hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-navy-600 disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : 'Add to my calendar'}
                </button>
              </form>
            </div>
          )}

          <div className="bg-white shadow rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {staffUser && activeTab === 'staff' && (
                <div>
                  <label htmlFor="availability-staff-select" className="block text-sm font-medium text-navy-800 mb-2">
                    Select staff
                  </label>
                  <select
                    id="availability-staff-select"
                    value={selectedCarerId}
                    onChange={(e) => setSelectedCarerId(e.target.value)}
                    className="w-full px-3 py-2 border border-navy-200 rounded-md shadow-sm focus:outline-none focus:ring-navy-600 focus:border-navy-600"
                  >
                    <option value="all">All staff</option>
                    {carers.map((staffMember) => (
                      <option key={staffMember.id} value={staffMember.id}>
                        {staffMember.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="availability-start-date" className="block text-sm font-medium text-navy-800 mb-2">
                  Range start
                </label>
                <input
                  id="availability-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-navy-200 rounded-md shadow-sm focus:outline-none focus:ring-navy-600 focus:border-navy-600"
                />
              </div>
              <div>
                <label htmlFor="availability-end-date" className="block text-sm font-medium text-navy-800 mb-2">
                  Range end
                </label>
                <input
                  id="availability-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-navy-200 rounded-md shadow-sm focus:outline-none focus:ring-navy-600 focus:border-navy-600"
                />
              </div>
            </div>
          </div>

          {activeTab === 'my' && (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="px-6 py-4 border-b border-navy-100">
                <h2 className="text-lg font-medium text-navy-900">Your periods in this range</h2>
                <p className="text-sm text-navy-800/70 mt-1">
                  Scheduling treats &quot;not available&quot; as blocked; other times are treated as open unless you add
                  specific &quot;available&quot; windows.
                </p>
              </div>

              {loadingMyAvailability ? (
                <div className="px-6 py-8 text-center text-navy-800/70" role="status" aria-live="polite">
                  Loading…
                </div>
              ) : myAvailability.length === 0 ? (
                <div className="px-6 py-8 text-center text-navy-800/70">
                  No periods in this date range. Add one above, or widen the range.
                </div>
              ) : (
                <table className="min-w-full divide-y divide-navy-100">
                  <caption className="sr-only">Your availability periods</caption>
                  <thead className="bg-navy-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-navy-800/70 uppercase tracking-wider"
                      >
                        Type
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-navy-800/70 uppercase tracking-wider"
                      >
                        Start
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-navy-800/70 uppercase tracking-wider"
                      >
                        End
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-navy-800/70 uppercase tracking-wider"
                      >
                        Duration
                      </th>
                      <th scope="col" className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-navy-100">
                    {myAvailability.map((item) => {
                      const start = new Date(item.startTime);
                      const end = new Date(item.endTime);
                      return (
                        <tr key={item.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span
                              className={
                                item.isAvailable
                                  ? 'inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800'
                                  : 'inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-amber-900'
                              }
                            >
                              {item.isAvailable ? 'Available' : 'Not available'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-navy-800/70">
                            {format(start, 'MMM d, yyyy HH:mm')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-navy-800/70">
                            {format(end, 'MMM d, yyyy HH:mm')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-navy-800/70">
                            {rowDuration(start, end)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <div className="flex items-center justify-end gap-3">
                              <button
                                type="button"
                                onClick={() => beginEditMyPeriod(item)}
                                className="text-navy-600 hover:text-navy-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 rounded-sm"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void removeMyPeriod(item.id)}
                                className="text-navy-600 hover:text-navy-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 rounded-sm"
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'my' && editingPeriodId && (
            <div className="bg-white shadow rounded-lg p-6 border border-navy-100">
              <h2 className="text-lg font-medium text-navy-900 mb-4">Edit period</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="availability-edit-start" className="block text-sm font-medium text-navy-800 mb-1">
                    Starts
                  </label>
                  <input
                    id="availability-edit-start"
                    type="datetime-local"
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                    className="w-full px-3 py-2 border border-navy-200 rounded-md shadow-sm focus:outline-none focus:ring-navy-600 focus:border-navy-600"
                  />
                </div>
                <div>
                  <label htmlFor="availability-edit-end" className="block text-sm font-medium text-navy-800 mb-1">
                    Ends
                  </label>
                  <input
                    id="availability-edit-end"
                    type="datetime-local"
                    value={editEnd}
                    onChange={(e) => setEditEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-navy-200 rounded-md shadow-sm focus:outline-none focus:ring-navy-600 focus:border-navy-600"
                  />
                </div>
              </div>
              <div className="mt-4">
                <span className="block text-sm font-medium text-navy-800 mb-2">Meaning</span>
                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex items-center gap-2 text-sm text-navy-800 cursor-pointer">
                    <input
                      type="radio"
                      name="editBlockKind"
                      checked={editKind === 'unavailable'}
                      onChange={() => setEditKind('unavailable')}
                      className="text-navy-600 focus:ring-navy-600"
                    />
                    Not available
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-navy-800 cursor-pointer">
                    <input
                      type="radio"
                      name="editBlockKind"
                      checked={editKind === 'available'}
                      onChange={() => setEditKind('available')}
                      className="text-navy-600 focus:ring-navy-600"
                    />
                    Available
                  </label>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void saveEditMyPeriod()}
                  disabled={updating}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-navy-600 hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-navy-600 disabled:opacity-50"
                >
                  {updating ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={cancelEditMyPeriod}
                  disabled={updating}
                  className="inline-flex justify-center py-2 px-4 border border-navy-200 text-sm font-medium rounded-md text-navy-800 hover:bg-navy-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {staffUser && activeTab === 'staff' && (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="px-6 py-4 border-b border-navy-100">
                <h2 className="text-lg font-medium text-navy-900">
                  Staff unavailability
                  {selectedCarerId !== 'all' && (
                    <span className="text-sm text-navy-800/70 ml-2">for {getStaffName(selectedCarerId)}</span>
                  )}
                </h2>
              </div>

              {loadingStaffAvailability ? (
                <div className="px-6 py-8 text-center text-navy-800/70" role="status" aria-live="polite">
                  Loading…
                </div>
              ) : currentStaffRows.length === 0 ? (
                <div className="px-6 py-8 text-center text-navy-800/70">
                  No unavailability in this range for the selection.
                </div>
              ) : (
                <table className="min-w-full divide-y divide-navy-100">
                  <caption className="sr-only">Staff unavailability periods</caption>
                  <thead className="bg-navy-50">
                    <tr>
                      {selectedCarerId === 'all' && (
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-navy-800/70 uppercase tracking-wider"
                        >
                          Staff
                        </th>
                      )}
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-navy-800/70 uppercase tracking-wider"
                      >
                        Start
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-navy-800/70 uppercase tracking-wider"
                      >
                        End
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-navy-800/70 uppercase tracking-wider"
                      >
                        Duration
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-navy-100">
                    {currentStaffRows.map((item) => {
                      const start = new Date(item.startTime);
                      const end = new Date(item.endTime);
                      return (
                        <tr key={item.id}>
                          {selectedCarerId === 'all' && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-navy-900">
                              {getStaffName(item.carerId)}
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-navy-800/70">
                            {format(start, 'MMM d, yyyy HH:mm')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-navy-800/70">
                            {format(end, 'MMM d, yyyy HH:mm')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-navy-800/70">
                            {rowDuration(start, end)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
