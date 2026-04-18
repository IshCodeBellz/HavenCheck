'use client';

import { useCallback, useEffect, useState } from 'react';
import { format, subDays } from 'date-fns';
import { apiV1 } from '@/lib/api-v1';

type MarEvent = {
  id: string;
  status: string;
  reasonCode: string | null;
  note: string | null;
  prnIndication: string | null;
  dosageGiven: string | null;
  signatureImage: string | null;
  signedAt: string | null;
  effectivenessNote: string | null;
  administeredAt: string;
  client: { id: string; name: string };
  medication: { id: string; name: string; dosage: string | null; isPrn: boolean; currentStock: number | null; reorderThreshold: number | null };
  visit: { id: string; scheduledStart: string | null; carer: { id: string; name: string } };
  recordedBy: { id: string; name: string };
};

type ComplianceSummary = {
  totalEvents: number;
  administered: number;
  omitted: number;
  administeredRate: number;
  omittedRate: number;
  topOmissionReasons: { reason: string; count: number }[];
};
type ExceptionsSummary = {
  summary: { missed: number; refused: number; late: number };
};

type MedAlert = {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  createdAt: string;
  acknowledgedAt: string | null;
  client: { id: string; name: string };
  medication: { id: string; name: string; isPrn: boolean };
  visit: { id: string; scheduledStart: string | null; clockInTime: string | null } | null;
  schedule: { id: string; timeOfDay: string } | null;
};

type ClientOption = { id: string; name: string };

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return fallback;
}

export default function AdminMarPage() {
  const [events, setEvents] = useState<MarEvent[]>([]);
  const [compliance, setCompliance] = useState<ComplianceSummary | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionsSummary | null>(null);
  const [alerts, setAlerts] = useState<MedAlert[]>([]);
  const [showAcknowledgedAlerts, setShowAcknowledgedAlerts] = useState(false);
  const [runningDetection, setRunningDetection] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [clientId, setClientId] = useState('');
  const [from, setFrom] = useState(format(subDays(new Date(), 14), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiV1
      .get<ClientOption[]>('/admin/clients')
      .then((res) => {
        if (!cancelled) setClients(res.data);
      })
      .catch(() => {
        if (!cancelled) setClients([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        from,
        to,
        status: status || undefined,
        clientId: clientId || undefined,
      };
      const [marRes, compRes, excRes, alertsRes] = await Promise.all([
        apiV1.get<MarEvent[]>('/admin/reports/mar-chart', { params }),
        apiV1.get<ComplianceSummary>('/admin/reports/medication-compliance', {
          params: { from, to, clientId: clientId || undefined },
        }),
        apiV1.get<ExceptionsSummary>('/emar/exceptions', {
          params: { from, to, clientId: clientId || undefined },
        }),
        apiV1.get<{ alerts: MedAlert[] }>('/emar/alerts', {
          params: { includeAcknowledged: showAcknowledgedAlerts ? '1' : undefined },
        }),
      ]);
      setEvents(marRes.data);
      setCompliance(compRes.data);
      setExceptions(excRes.data);
      setAlerts(alertsRes.data.alerts);
    } catch (e: unknown) {
      setEvents([]);
      setCompliance(null);
      setExceptions(null);
      setAlerts([]);
      console.error(getErrorMessage(e, 'Failed to load MAR data'));
    } finally {
      setLoading(false);
    }
  }, [clientId, from, showAcknowledgedAlerts, status, to]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await apiV1.patch(`/emar/alerts/${alertId}/acknowledge`);
      await load();
    } catch (e: unknown) {
      console.error(getErrorMessage(e, 'Failed to acknowledge alert'));
    }
  };

  const handleRunDetection = async () => {
    setRunningDetection(true);
    try {
      await apiV1.post('/emar/alerts/run-detection');
      await load();
    } catch (e: unknown) {
      console.error(getErrorMessage(e, 'Detection run failed'));
    } finally {
      setRunningDetection(false);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const res = await apiV1.get('/admin/reports/mar-chart/export', {
        params: {
          from,
          to,
          status: status || undefined,
          clientId: clientId || undefined,
        },
        responseType: 'blob',
      });
      const blob = res.data as Blob;
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `mar-export-${from}-to-${to}.csv`;
      a.click();
      URL.revokeObjectURL(href);
    } catch (e: unknown) {
      console.error(getErrorMessage(e, 'CSV export failed'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-navy-900">MAR chart (events)</h2>
        <p className="text-sm text-navy-800/70 mt-1">
          Medication administration and omissions from visit workflows. Date range uses local start/end of day.
        </p>
      </div>

      <div className="rounded-xl border border-navy-100 bg-white p-4 flex flex-wrap items-end gap-3">
        <label className="text-sm text-navy-800">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="block mt-1 rounded-lg border border-navy-200 px-3 py-2"
          />
        </label>
        <label className="text-sm text-navy-800">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="block mt-1 rounded-lg border border-navy-200 px-3 py-2"
          />
        </label>
        <label className="text-sm text-navy-800">
          Client
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="block mt-1 min-w-[12rem] rounded-lg border border-navy-200 px-3 py-2"
          >
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-navy-800">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="block mt-1 rounded-lg border border-navy-200 px-3 py-2"
          >
            <option value="">All</option>
            <option value="ADMINISTERED">Administered</option>
            <option value="OMITTED">Omitted</option>
          </select>
        </label>
        <button
          type="button"
          onClick={load}
          className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800"
        >
          Refresh
        </button>
        <button
          type="button"
          onClick={handleRunDetection}
          disabled={runningDetection}
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
        >
          {runningDetection ? 'Running…' : 'Run alert detection'}
        </button>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={exporting}
          className="rounded-lg border border-navy-300 px-4 py-2 text-sm font-medium text-navy-900 hover:bg-navy-50 disabled:opacity-50"
        >
          {exporting ? 'Exporting…' : 'Download CSV'}
        </button>
      </div>

      <div className="rounded-xl border border-navy-100 bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium text-navy-900">Medication alerts</h3>
          <label className="flex items-center gap-2 text-sm text-navy-800">
            <input
              type="checkbox"
              checked={showAcknowledgedAlerts}
              onChange={(e) => setShowAcknowledgedAlerts(e.target.checked)}
            />
            Show acknowledged
          </label>
        </div>
        {loading ? (
          <p className="text-sm text-navy-700">Loading alerts…</p>
        ) : alerts.length === 0 ? (
          <p className="text-sm text-navy-700">No active alerts. Scheduled detection can be enabled with ENABLE_MED_ALERT_CRON=1 on the API server.</p>
        ) : (
          <ul className="divide-y divide-navy-100 border border-navy-100 rounded-lg overflow-hidden">
            {alerts.map((a) => (
              <li key={a.id} className="px-3 py-3 bg-white flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-navy-600">{a.type.replace(/_/g, ' ')}</p>
                  <p className="font-medium text-navy-900">{a.title}</p>
                  {a.detail && <p className="text-sm text-navy-800 mt-1">{a.detail}</p>}
                  <p className="text-xs text-navy-600 mt-1">
                    {a.client.name} · {a.medication.name}
                    {a.schedule && ` · due ${a.schedule.timeOfDay}`}
                    {' · '}
                    {format(new Date(a.createdAt), 'MMM d, yyyy HH:mm')}
                    {a.acknowledgedAt && (
                      <span className="ml-2 text-green-800">Acknowledged {format(new Date(a.acknowledgedAt), 'MMM d, HH:mm')}</span>
                    )}
                  </p>
                </div>
                {!a.acknowledgedAt && (
                  <button
                    type="button"
                    onClick={() => handleAcknowledgeAlert(a.id)}
                    className="shrink-0 rounded-lg border border-navy-200 px-3 py-1.5 text-sm text-navy-900 hover:bg-navy-50"
                  >
                    Acknowledge
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {compliance && !loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-navy-100 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-navy-600">Total events</p>
            <p className="mt-1 text-2xl font-semibold text-navy-900">{compliance.totalEvents}</p>
          </div>
          <div className="rounded-xl border border-navy-100 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-navy-600">Administered</p>
            <p className="mt-1 text-2xl font-semibold text-green-800">{compliance.administered}</p>
            <p className="text-xs text-navy-700 mt-1">
              {(compliance.administeredRate * 100).toFixed(1)}% of total
            </p>
          </div>
          <div className="rounded-xl border border-navy-100 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-navy-600">Omitted</p>
            <p className="mt-1 text-2xl font-semibold text-orange-800">{compliance.omitted}</p>
            <p className="text-xs text-navy-700 mt-1">{(compliance.omittedRate * 100).toFixed(1)}% of total</p>
          </div>
          <div className="rounded-xl border border-navy-100 bg-white p-4 sm:col-span-2 lg:col-span-1">
            <p className="text-xs font-medium uppercase tracking-wide text-navy-600">Top omission reasons</p>
            {compliance.topOmissionReasons.length === 0 ? (
              <p className="mt-2 text-sm text-navy-700">None in range</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-navy-800">
                {compliance.topOmissionReasons.map((r) => (
                  <li key={r.reason} className="flex justify-between gap-2">
                    <span className="truncate">{r.reason}</span>
                    <span className="font-medium tabular-nums">{r.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {exceptions && !loading && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-navy-100 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-navy-600">Missed</p>
            <p className="mt-1 text-2xl font-semibold text-red-800">{exceptions.summary.missed}</p>
          </div>
          <div className="rounded-xl border border-navy-100 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-navy-600">Refused</p>
            <p className="mt-1 text-2xl font-semibold text-orange-800">{exceptions.summary.refused}</p>
          </div>
          <div className="rounded-xl border border-navy-100 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-navy-600">Late meds</p>
            <p className="mt-1 text-2xl font-semibold text-amber-700">{exceptions.summary.late}</p>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-navy-800">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-navy-50 text-left text-navy-800">
              <tr>
                <th className="px-3 py-2">Date/Time</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Medication</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Carer</th>
                <th className="px-3 py-2">Reason/PRN/Signature</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="px-3 py-2">{format(new Date(event.administeredAt), 'MMM d, yyyy HH:mm')}</td>
                  <td className="px-3 py-2">{event.client.name}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-navy-900">{event.medication.name}</div>
                    {event.medication.dosage && <div className="text-xs text-navy-700">{event.medication.dosage}</div>}
                  </td>
                  <td className="px-3 py-2">{event.status}</td>
                  <td className="px-3 py-2">{event.visit?.carer?.name ?? event.recordedBy.name}</td>
                  <td className="px-3 py-2">
                    {event.reasonCode || event.prnIndication ? (
                      <div className="space-y-1">
                        {event.reasonCode && <div>Reason: {event.reasonCode}</div>}
                        {event.prnIndication && <div>PRN: {event.prnIndication}</div>}
                        {event.dosageGiven && <div>PRN dosage: {event.dosageGiven}</div>}
                        {event.signedAt && <div>Signed: {format(new Date(event.signedAt), 'MMM d, HH:mm')}</div>}
                      </div>
                    ) : (
                      <span className="text-navy-500">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {event.note || event.effectivenessNote ? (
                      <div className="space-y-1">
                        {event.note && <div>{event.note}</div>}
                        {event.effectivenessNote && (
                          <div className="text-xs text-navy-700">Effectiveness: {event.effectivenessNote}</div>
                        )}
                        {(event.medication.currentStock !== null || event.medication.reorderThreshold !== null) && (
                          <div className="text-xs text-navy-700">
                            Stock {event.medication.currentStock ?? '—'} / Threshold {event.medication.reorderThreshold ?? '—'}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-navy-500">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-navy-700">
                    No MAR events found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
