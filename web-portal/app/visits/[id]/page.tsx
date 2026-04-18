'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { format } from 'date-fns';
import { authService, type User } from '@/lib/auth';
import { isCarerLikeRole } from '@/lib/roles';

function getCurrentPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      reject(new Error('Location is only available in a browser.'));
      return;
    }
    if (!window.isSecureContext) {
      reject(new Error('Location requires a secure page (HTTPS or localhost).'));
      return;
    }
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            reject(
              new Error(
                'Location permission was denied. Enable location access for this site in your browser settings and try again.'
              )
            );
            break;
          case err.POSITION_UNAVAILABLE:
            reject(new Error('Location is currently unavailable. Check device location services and try again.'));
            break;
          case err.TIMEOUT:
            reject(new Error('Location request timed out. Move to better signal and try again.'));
            break;
          default:
            reject(new Error('Could not read your location.'));
            break;
        }
      },
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 }
    );
  });
}

interface ChecklistSubmission {
  id: string;
  submittedAt: string;
  intervalIndex?: number;
  template?: {
    name: string;
  };
  items: Array<{
    checklistItem?: {
      label: string;
      type: string;
    };
    valueBoolean?: boolean;
    valueText?: string;
    valueNumber?: number;
    valueOption?: string;
  }>;
}

interface Note {
  id: string;
  type: string;
  priority: string;
  text: string;
  createdAt: string;
  author: {
    name: string;
  };
}

interface MedicationEventRow {
  id: string;
  administeredAt: string;
  status: string;
  note: string | null;
  reasonCode: string | null;
  prnIndication: string | null;
  dosageGiven: string | null;
  signatureImage: string | null;
  signedAt: string | null;
  effectivenessNote: string | null;
  medication: { name: string; dosage: string | null; isPrn: boolean };
  schedule: { id: string; timeOfDay: string } | null;
  recordedBy: { id: string; name: string };
}

interface Visit {
  id: string;
  client: { name: string; address: string };
  carer: { id: string; name: string; email: string };
  scheduledStart?: string;
  scheduledEnd?: string;
  clockInTime?: string;
  clockOutTime?: string;
  status: string;
  lateClockInReason?: string;
  checklistSubmissions: ChecklistSubmission[];
  notes: Note[];
  medicationEvents?: MedicationEventRow[];
}

export default function VisitDetailPage() {
  const params = useParams();
  const visitId = params.id as string;
  const [me, setMe] = useState<User | null>(null);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lateModalOpen, setLateModalOpen] = useState(false);
  const [lateReason, setLateReason] = useState('');
  const [pendingCoords, setPendingCoords] = useState<{ latitude: number; longitude: number } | null>(
    null
  );
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState<'GENERAL' | 'HANDOVER' | 'INCIDENT'>('GENERAL');
  const [notePriority, setNotePriority] = useState<'NORMAL' | 'HIGH'>('NORMAL');
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  useEffect(() => {
    authService.getCurrentUser().then(setMe);
  }, []);

  const loadVisit = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const response = await api.get(`/visits/${visitId}`);
        setVisit(response.data);
      } catch (error) {
        console.error('Error loading visit:', error);
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [visitId]
  );

  useEffect(() => {
    loadVisit();
  }, [loadVisit]);

  const runClockIn = async (
    latitude: number,
    longitude: number,
    lateClockInReason?: string
  ) => {
    const body: { latitude: number; longitude: number; lateClockInReason?: string } = {
      latitude,
      longitude,
    };
    if (lateClockInReason?.trim()) body.lateClockInReason = lateClockInReason.trim();
    await api.post(`/visits/${visitId}/clock-in`, body);
    await loadVisit({ silent: true });
  };

  const handleClockIn = async () => {
    setActionError(null);
    setActionLoading(true);
    try {
      const coords = await getCurrentPosition();
      try {
        await runClockIn(coords.latitude, coords.longitude);
      } catch (err: unknown) {
        const data = err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { requiresReason?: boolean; error?: string } } }).response
              ?.data
          : undefined;
        if (data?.requiresReason) {
          setPendingCoords(coords);
          setLateModalOpen(true);
        } else {
          setActionError(data?.error || 'Clock in failed');
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not read your location';
      setActionError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLateModalSubmit = async () => {
    if (!pendingCoords || !lateReason.trim()) {
      setActionError('Please enter a reason for late clock-in.');
      return;
    }
    setActionError(null);
    setActionLoading(true);
    try {
      await runClockIn(pendingCoords.latitude, pendingCoords.longitude, lateReason);
      setLateModalOpen(false);
      setLateReason('');
      setPendingCoords(null);
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data
        : undefined;
      setActionError(data?.error || 'Clock in failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    setActionError(null);
    setActionLoading(true);
    try {
      const coords = await getCurrentPosition();
      await api.post(`/visits/${visitId}/clock-out`, coords);
      await loadVisit({ silent: true });
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data
        : undefined;
      setActionError(data?.error || (err instanceof Error ? err.message : 'Clock out failed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visit || !noteText.trim()) return;
    setNoteSubmitting(true);
    setActionError(null);
    try {
      await api.post('/notes', {
        visitId: visit.id,
        type: noteType,
        priority: noteType === 'INCIDENT' ? notePriority : 'NORMAL',
        text: noteText.trim(),
      });
      setNoteText('');
      await loadVisit({ silent: true });
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data
        : undefined;
      setActionError(data?.error || 'Could not save note');
    } finally {
      setNoteSubmitting(false);
    }
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

  if (!visit) {
    return (
      <Layout>
        <p role="status" className="text-navy-800">
          Visit not found
        </p>
      </Layout>
    );
  }

  const handoverNotes = visit.notes.filter((n) => n.type === 'HANDOVER');
  const generalNotes = visit.notes.filter((n) => n.type === 'GENERAL');
  const incidentNotes = visit.notes.filter((n) => n.type === 'INCIDENT');

  const isAssignedCarer = me?.role === 'CARER' && me.id === visit.carer.id;
  const viewerIsCarer = isCarerLikeRole(me?.role);
  const canClockIn =
    isAssignedCarer &&
    !visit.clockInTime &&
    visit.status !== 'COMPLETED' &&
    visit.status !== 'MISSED';
  const canClockOut = isAssignedCarer && !!visit.clockInTime && !visit.clockOutTime;

  return (
    <Layout>
      <div>
        <div className="mb-6">
          <Link
            href="/visits"
            className="text-navy-600 hover:text-navy-800 mb-4 inline-block"
          >
            {viewerIsCarer ? '← Back to My visits' : '← Back to Visits'}
          </Link>
          <h1 className="text-3xl font-bold text-navy-900">Visit Details</h1>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Visit Information */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-bold text-navy-900 mb-4">Visit Information</h2>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-navy-800/70">Client:</span>
                <p className="text-sm text-navy-900">{visit.client.name}</p>
                <p className="text-sm text-navy-800/70">{visit.client.address}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-navy-800/70">Carer:</span>
                <p className="text-sm text-navy-900">{visit.carer.name}</p>
                <p className="text-sm text-navy-800/70">{visit.carer.email}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-navy-800/70">Scheduled Time:</span>
                <p className="text-sm text-navy-900">
                  {visit.scheduledStart
                    ? format(new Date(visit.scheduledStart), 'MMM d, yyyy HH:mm')
                    : '-'}
                  {visit.scheduledEnd && ` - ${format(new Date(visit.scheduledEnd), 'HH:mm')}`}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-navy-800/70">Clock In:</span>
                <p className="text-sm text-navy-900">
                  {visit.clockInTime
                    ? format(new Date(visit.clockInTime), 'MMM d, yyyy HH:mm')
                    : '-'}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-navy-800/70">Clock Out:</span>
                <p className="text-sm text-navy-900">
                  {visit.clockOutTime
                    ? format(new Date(visit.clockOutTime), 'MMM d, yyyy HH:mm')
                    : '-'}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-navy-800/70">Status:</span>
                <span
                  className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                    visit.status
                  )}`}
                >
                  {visit.status.replace('_', ' ')}
                </span>
              </div>
              {visit.lateClockInReason && (
                <div>
                  <span className="text-sm font-medium text-navy-800/70">Late Clock-In Reason:</span>
                  <p className="text-sm text-navy-900 mt-1 p-2 bg-yellow-50 rounded">
                    {visit.lateClockInReason}
                  </p>
                </div>
              )}
            </div>
          </div>

          {isAssignedCarer && (
            <div className="bg-white shadow rounded-lg p-6 lg:col-span-2 border border-navy-100">
              <h2 className="text-xl font-bold text-navy-900 mb-3">Your visit actions</h2>
              <p className="text-sm text-navy-800/80 mb-4">
                Clock in and out uses your browser location and the same rules as the mobile app (geofence
                and time window).
              </p>
              {actionError && (
                <div
                  role="alert"
                  className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm"
                >
                  {actionError}
                </div>
              )}
              <div className="flex flex-wrap gap-3 mb-6">
                {canClockIn && (
                  <button
                    type="button"
                    onClick={handleClockIn}
                    disabled={actionLoading}
                    className="px-4 py-2.5 rounded-lg bg-navy-600 text-white text-sm font-semibold hover:bg-navy-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 focus-visible:ring-offset-2"
                  >
                    {actionLoading && !lateModalOpen ? 'Working…' : 'Clock in'}
                  </button>
                )}
                {canClockOut && (
                  <button
                    type="button"
                    onClick={handleClockOut}
                    disabled={actionLoading}
                    className="cursor-pointer px-4 py-2.5 rounded-xl bg-accent-400 text-navy-900 text-sm font-semibold shadow-sm transition-all duration-200 hover:bg-accent-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 focus-visible:ring-offset-2"
                  >
                    {actionLoading ? 'Working…' : 'Clock out'}
                  </button>
                )}
              </div>

              <h3 className="text-lg font-semibold text-navy-900 mb-2">Add a note</h3>
              <form onSubmit={handleAddNote} className="space-y-3 max-w-xl">
                <div>
                  <label htmlFor="visit-note-type" className="block text-sm font-medium text-navy-800 mb-1">
                    Type
                  </label>
                  <select
                    id="visit-note-type"
                    value={noteType}
                    onChange={(e) =>
                      setNoteType(e.target.value as 'GENERAL' | 'HANDOVER' | 'INCIDENT')
                    }
                    className="w-full px-3 py-2 border border-navy-200 rounded-md text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-600"
                  >
                    <option value="GENERAL">General</option>
                    <option value="HANDOVER">Handover</option>
                    <option value="INCIDENT">Incident</option>
                  </select>
                </div>
                {noteType === 'INCIDENT' && (
                  <div>
                    <label
                      htmlFor="visit-note-priority"
                      className="block text-sm font-medium text-navy-800 mb-1"
                    >
                      Priority
                    </label>
                    <select
                      id="visit-note-priority"
                      value={notePriority}
                      onChange={(e) => setNotePriority(e.target.value as 'NORMAL' | 'HIGH')}
                      className="w-full px-3 py-2 border border-navy-200 rounded-md text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-600"
                    >
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>
                )}
                <div>
                  <label htmlFor="visit-note-text" className="block text-sm font-medium text-navy-800 mb-1">
                    Note
                  </label>
                  <textarea
                    id="visit-note-text"
                    required
                    rows={3}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="w-full px-3 py-2 border border-navy-200 rounded-md text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={noteSubmitting}
                  className="px-4 py-2 rounded-md bg-navy-100 text-navy-900 text-sm font-medium hover:bg-navy-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600"
                >
                  {noteSubmitting ? 'Saving…' : 'Save note'}
                </button>
              </form>
            </div>
          )}

          {/* Medication events (eMAR) */}
          <div className="bg-white shadow rounded-lg p-6 lg:col-span-2">
            <h2 className="text-xl font-bold text-navy-900 mb-2">Medication events (eMAR)</h2>
            <p className="text-sm text-navy-800/70 mb-4">
              Administration and omissions recorded against this visit (mobile carer workflow).
            </p>
            {!visit.medicationEvents || visit.medicationEvents.length === 0 ? (
              <p className="text-sm text-navy-800/70">No medication events recorded for this visit.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-navy-100">
                <table className="min-w-full text-sm">
                  <thead className="bg-navy-50 text-left text-navy-800">
                    <tr>
                      <th className="px-3 py-2">Time</th>
                      <th className="px-3 py-2">Medication</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Schedule</th>
                      <th className="px-3 py-2">Recorded by</th>
                      <th className="px-3 py-2">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-100">
                    {visit.medicationEvents.map((ev) => (
                      <tr key={ev.id}>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {format(new Date(ev.administeredAt), 'MMM d, yyyy HH:mm')}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-navy-900">{ev.medication.name}</div>
                          {ev.medication.dosage && (
                            <div className="text-xs text-navy-700">{ev.medication.dosage}</div>
                          )}
                          {ev.medication.isPrn && (
                            <span className="text-xs text-navy-600">PRN</span>
                          )}
                        </td>
                        <td className="px-3 py-2">{ev.status}</td>
                        <td className="px-3 py-2">{ev.schedule?.timeOfDay ?? '—'}</td>
                        <td className="px-3 py-2">{ev.recordedBy.name}</td>
                        <td className="px-3 py-2 text-navy-800">
                          {ev.reasonCode && <div>Reason: {ev.reasonCode}</div>}
                          {ev.prnIndication && <div>PRN: {ev.prnIndication}</div>}
                          {ev.dosageGiven && <div>PRN dosage: {ev.dosageGiven}</div>}
                          {ev.signedAt && (
                            <div className="text-xs text-navy-700">
                              Signed: {format(new Date(ev.signedAt), 'MMM d, yyyy HH:mm')}
                            </div>
                          )}
                          {ev.note && <div>{ev.note}</div>}
                          {ev.effectivenessNote && (
                            <div className="text-xs text-navy-700">Effectiveness: {ev.effectivenessNote}</div>
                          )}
                          {!ev.reasonCode && !ev.prnIndication && !ev.note && !ev.effectivenessNote && (
                            <span className="text-navy-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Checklists */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-bold text-navy-900 mb-4">Checklists</h2>
            {visit.checklistSubmissions.length === 0 ? (
              <p className="text-sm text-navy-800/70">No checklists submitted</p>
            ) : (
              <div className="space-y-4">
                {visit.checklistSubmissions.map((submission) => (
                  <div key={submission.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-medium text-navy-900">
                          {submission.template?.name || 'Checklist'}
                        </p>
                        <p className="text-xs text-navy-800/70">
                          {format(new Date(submission.submittedAt), 'MMM d, yyyy HH:mm')}
                        </p>
                      </div>
                      {submission.intervalIndex !== null && submission.intervalIndex !== undefined && (
                        <span className="text-xs bg-navy-100 text-navy-800 px-2 py-1 rounded">
                          Interval {submission.intervalIndex + 1}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      {submission.items.map((item, idx) => (
                        <div key={idx} className="text-sm">
                          <span className="font-medium text-navy-800">
                            {item.checklistItem?.label || `Item ${idx + 1}`}:
                          </span>{' '}
                          <span className="text-navy-800/80">
                            {item.valueBoolean !== undefined
                              ? item.valueBoolean
                                ? 'Yes'
                                : 'No'
                              : item.valueText ||
                                item.valueNumber?.toString() ||
                                item.valueOption ||
                                '-'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Handover Notes */}
          {handoverNotes.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-bold text-navy-900 mb-4">Handover Notes</h2>
              <div className="space-y-3">
                {handoverNotes.map((note) => (
                  <div key={note.id} className="border-l-4 border-accent-400 pl-4 py-2">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-medium text-navy-900">
                        {note.author.name}
                      </span>
                      <span className="text-xs text-navy-800/70">
                        {format(new Date(note.createdAt), 'MMM d, HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm text-navy-800">{note.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* General Notes */}
          {generalNotes.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-bold text-navy-900 mb-4">General Notes</h2>
              <div className="space-y-3">
                {generalNotes.map((note) => (
                  <div key={note.id} className="border-l-4 border-navy-200 pl-4 py-2">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-medium text-navy-900">
                        {note.author.name}
                      </span>
                      <span className="text-xs text-navy-800/70">
                        {format(new Date(note.createdAt), 'MMM d, HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm text-navy-800">{note.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Incident Notes */}
          {incidentNotes.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-bold text-navy-900 mb-4">Incident Notes</h2>
              <div className="space-y-3">
                {incidentNotes.map((note) => (
                  <div
                    key={note.id}
                    className={`border-l-4 pl-4 py-2 ${
                      note.priority === 'HIGH' ? 'border-red-500 bg-red-50' : 'border-orange-500'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-navy-900">
                          {note.author.name}
                        </span>
                        {note.priority === 'HIGH' && (
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                            HIGH PRIORITY
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-navy-800/70">
                        {format(new Date(note.createdAt), 'MMM d, HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm text-navy-800">{note.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {lateModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="late-clockin-title"
          >
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h2 id="late-clockin-title" className="text-lg font-bold text-navy-900 mb-2">
                Late clock-in
              </h2>
              <p className="text-sm text-navy-800/80 mb-4">
                Please give a short reason for clocking in more than 15 minutes after the scheduled start.
              </p>
              <textarea
                value={lateReason}
                onChange={(e) => setLateReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-navy-200 rounded-md text-navy-900 mb-4 focus:outline-none focus:ring-2 focus:ring-navy-600"
                placeholder="Reason"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLateModalOpen(false);
                    setLateReason('');
                    setPendingCoords(null);
                  }}
                  className="px-4 py-2 text-sm text-navy-800 hover:bg-navy-50 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLateModalSubmit}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-semibold bg-navy-600 text-white rounded-md hover:bg-navy-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Submitting…' : 'Submit clock-in'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

