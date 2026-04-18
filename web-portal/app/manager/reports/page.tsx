'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import Layout from '@/components/Layout';
import { apiV1 } from '@/lib/api-v1';
import { useRequireStaff } from '@/hooks/useRequireStaff';

type TabId = 'missed' | 'medication' | 'hours' | 'incidents' | 'payroll';

type ClientOpt = { id: string; name: string };
type CarerOpt = { id: string; name: string };

function filenameFromContentDisposition(cd: string | undefined, fallback: string) {
  if (!cd) return fallback;
  const m = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(cd);
  const raw = m?.[1]?.replace(/"/g, '')?.trim();
  if (!raw) return fallback;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const INCIDENT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const INCIDENT_STATUSES = ['REPORTED', 'TRIAGED', 'ESCALATED', 'ACTIONED', 'CLOSED'] as const;

export default function ManagerReportsPage() {
  const staffOk = useRequireStaff();
  const defaultTo = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const defaultFrom = useMemo(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'), []);
  const [tab, setTab] = useState<TabId>('missed');
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [clientId, setClientId] = useState('');
  const [carerId, setCarerId] = useState('');
  const [incidentSeverity, setIncidentSeverity] = useState('');
  const [incidentStatus, setIncidentStatus] = useState('');
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [carers, setCarers] = useState<CarerOpt[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<unknown>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [cRes, teamsRes] = await Promise.all([
          apiV1.get<ClientOpt[]>('/manager/clients'),
          apiV1.get<{ members: { user: { id: string; name: string; role: string } }[] }[]>('/manager/teams/me'),
        ]);
        setClients(cRes.data.map((c) => ({ id: c.id, name: c.name })));
        const carerMap = new Map<string, string>();
        for (const team of teamsRes.data) {
          for (const m of team.members || []) {
            if (m.user.role === 'CARER') carerMap.set(m.user.id, m.user.name);
          }
        }
        setCarers([...carerMap.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)));
      } catch {
        /* optional filters */
      }
    })();
  }, []);

  const commonParams = useMemo(() => {
    const p: Record<string, string> = { from, to };
    if (clientId) p.clientId = clientId;
    if (carerId && (tab === 'hours' || tab === 'payroll' || tab === 'missed')) p.carerId = carerId;
    if (tab === 'incidents') {
      if (incidentSeverity) p.severity = incidentSeverity;
      if (incidentStatus) p.status = incidentStatus;
    }
    return p;
  }, [from, to, clientId, carerId, tab, incidentSeverity, incidentStatus]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const paths: Record<TabId, string> = {
        missed: '/manager/reports/ops/missed-visits',
        medication: '/manager/reports/ops/medication-compliance',
        hours: '/manager/reports/ops/hours-delivered',
        incidents: '/manager/reports/ops/incidents',
        payroll: '/manager/reports/ops/payroll-summary',
      };
      const res = await apiV1.get(paths[tab], { params: commonParams });
      setPayload(res.data);
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e !== null && 'response' in e
          ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message)
          : null;
      setError(msg || 'Failed to load report');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [tab, commonParams]);

  useEffect(() => {
    if (staffOk) void load();
  }, [staffOk, load]);

  const runExport = async () => {
    const paths: Record<TabId, string> = {
      missed: '/manager/reports/ops/missed-visits/export',
      medication: '/manager/reports/ops/medication-compliance/export',
      hours: '/manager/reports/ops/hours-delivered/export',
      incidents: '/manager/reports/ops/incidents/export',
      payroll: '/manager/reports/ops/payroll-summary/export',
    };
    setExporting(true);
    setError(null);
    try {
      const res = await apiV1.get(paths[tab], {
        params: commonParams,
        responseType: 'blob',
      });
      const fallback = `${tab}-report.csv`;
      triggerDownload(res.data as Blob, filenameFromContentDisposition(res.headers['content-disposition'], fallback));
    } catch (e: unknown) {
      let msg = 'Export failed';
      if (typeof e === 'object' && e !== null && 'response' in e) {
        const ax = e as { response?: { data?: Blob } };
        if (ax.response?.data instanceof Blob) {
          try {
            const text = await ax.response.data.text();
            const j = JSON.parse(text) as { message?: string };
            if (j.message) msg = j.message;
          } catch {
            /* ignore */
          }
        }
      }
      setError(msg);
    } finally {
      setExporting(false);
    }
  };

  if (staffOk === null || staffOk === false) {
    return (
      <Layout>
        <p role="status" className="text-navy-800">
          {staffOk === false ? 'Redirecting…' : 'Checking access…'}
        </p>
      </Layout>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'missed', label: 'Missed visits' },
    { id: 'medication', label: 'Medication compliance' },
    { id: 'hours', label: 'Hours delivered' },
    { id: 'incidents', label: 'Incidents' },
    { id: 'payroll', label: 'Payroll summary' },
  ];

  return (
    <Layout>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-navy-900">Reports</h1>
          <p className="text-sm text-navy-800/70 mt-1 max-w-2xl">
            Operational reports for your organisation: filter by date range, client, and (where relevant) carer, then
            export to CSV for audits and payroll checks.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-navy-100 bg-white p-4 shadow-sm">
          <label className="flex flex-col text-xs font-medium text-navy-800/80">
            From
            <input
              type="date"
              value={from}
              onChange={(ev) => setFrom(ev.target.value)}
              className="mt-1 rounded-lg border border-navy-200 px-2 py-1.5 text-sm text-navy-900"
            />
          </label>
          <label className="flex flex-col text-xs font-medium text-navy-800/80">
            To
            <input
              type="date"
              value={to}
              onChange={(ev) => setTo(ev.target.value)}
              className="mt-1 rounded-lg border border-navy-200 px-2 py-1.5 text-sm text-navy-900"
            />
          </label>
          <label className="flex flex-col text-xs font-medium text-navy-800/80">
            Client
            <select
              value={clientId}
              onChange={(ev) => setClientId(ev.target.value)}
              className="mt-1 rounded-lg border border-navy-200 px-2 py-1.5 text-sm text-navy-900 min-w-[10rem]"
            >
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {(tab === 'hours' || tab === 'payroll' || tab === 'missed') && (
            <label className="flex flex-col text-xs font-medium text-navy-800/80">
              Carer
              <select
                value={carerId}
                onChange={(ev) => setCarerId(ev.target.value)}
                className="mt-1 rounded-lg border border-navy-200 px-2 py-1.5 text-sm text-navy-900 min-w-[10rem]"
              >
                <option value="">All carers</option>
                {carers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {tab === 'incidents' && (
            <>
              <label className="flex flex-col text-xs font-medium text-navy-800/80">
                Severity
                <select
                  value={incidentSeverity}
                  onChange={(ev) => setIncidentSeverity(ev.target.value)}
                  className="mt-1 rounded-lg border border-navy-200 px-2 py-1.5 text-sm text-navy-900"
                >
                  <option value="">Any</option>
                  {INCIDENT_SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-xs font-medium text-navy-800/80">
                Status
                <select
                  value={incidentStatus}
                  onChange={(ev) => setIncidentStatus(ev.target.value)}
                  className="mt-1 rounded-lg border border-navy-200 px-2 py-1.5 text-sm text-navy-900"
                >
                  <option value="">Any</option>
                  {INCIDENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-navy-600 text-white text-sm font-medium shadow-sm hover:bg-navy-700 disabled:opacity-60"
          >
            {loading ? 'Loading…' : 'Apply'}
          </button>
          <button
            type="button"
            onClick={() => void runExport()}
            disabled={exporting || loading}
            className="px-4 py-2 rounded-xl border border-navy-200 text-sm font-medium text-navy-900 hover:bg-navy-50 disabled:opacity-50"
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-navy-100 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-navy-600 text-white' : 'text-navy-800 hover:bg-navy-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <p className="text-red-700 mb-4">{error}</p> : null}

      {loading && !payload ? (
        <p role="status" className="text-navy-800">
          Loading…
        </p>
      ) : null}

      {payload ? <ReportBody tab={tab} data={payload} /> : null}
    </Layout>
  );
}

function ReportBody({ tab, data }: { tab: TabId; data: unknown }) {
  if (tab === 'missed') {
    const d = data as {
      total: number;
      rows: { visitId: string; clientName: string; carerName: string; scheduledStart: string }[];
    };
    return (
      <div className="rounded-2xl border border-navy-100 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-navy-100 text-sm text-navy-800">
          <span className="font-semibold text-navy-900">{d.total}</span> missed visits in range
        </div>
        <div className="overflow-x-auto max-h-[28rem]">
          <table className="min-w-full text-sm">
            <thead className="bg-navy-50 text-left text-xs uppercase text-navy-700">
              <tr>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Carer</th>
                <th className="px-3 py-2">Scheduled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {d.rows.slice(0, 500).map((r) => (
                <tr key={r.visitId}>
                  <td className="px-3 py-2 text-navy-900">{r.clientName}</td>
                  <td className="px-3 py-2 text-navy-800">{r.carerName}</td>
                  <td className="px-3 py-2 text-navy-700 whitespace-nowrap">{r.scheduledStart || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (tab === 'medication') {
    const d = data as {
      summary: { totalEvents: number; administered: number; omitted: number; administeredRate: number };
      byClient: {
        clientId: string;
        clientName: string;
        administered: number;
        omitted: number;
        complianceRate: number | null;
      }[];
    };
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Events" value={String(d.summary.totalEvents)} />
          <Stat label="Administered" value={String(d.summary.administered)} />
          <Stat label="Omitted" value={String(d.summary.omitted)} />
          <Stat label="Compliance rate" value={`${(d.summary.administeredRate * 100).toFixed(1)}%`} />
        </div>
        <div className="rounded-2xl border border-navy-100 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-2 border-b border-navy-100 text-sm font-medium text-navy-900">By client</div>
          <div className="overflow-x-auto max-h-[24rem]">
            <table className="min-w-full text-sm">
              <thead className="bg-navy-50 text-left text-xs uppercase text-navy-700">
                <tr>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Administered</th>
                  <th className="px-3 py-2">Omitted</th>
                  <th className="px-3 py-2">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {d.byClient.map((r) => (
                  <tr key={r.clientId}>
                    <td className="px-3 py-2">{r.clientName}</td>
                    <td className="px-3 py-2">{r.administered}</td>
                    <td className="px-3 py-2">{r.omitted}</td>
                    <td className="px-3 py-2">
                      {r.complianceRate == null ? '—' : `${(r.complianceRate * 100).toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'hours') {
    const d = data as {
      totalHours: number;
      visitCount: number;
      byCarer: { carerId: string; carerName: string; visitCount: number; totalHours: number }[];
      byClient: { clientId: string; clientName: string; visitCount: number; totalHours: number }[];
    };
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Total hours" value={String(d.totalHours)} />
          <Stat label="Visits (clocked)" value={String(d.visitCount)} />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-navy-100 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b text-sm font-medium text-navy-900">By carer</div>
            <ul className="divide-y divide-navy-100 max-h-64 overflow-y-auto text-sm">
              {d.byCarer.map((r) => (
                <li key={r.carerId} className="px-3 py-2 flex justify-between">
                  <span className="text-navy-900">{r.carerName}</span>
                  <span className="text-navy-700">
                    {r.totalHours}h · {r.visitCount} visits
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-navy-100 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b text-sm font-medium text-navy-900">By client</div>
            <ul className="divide-y divide-navy-100 max-h-64 overflow-y-auto text-sm">
              {d.byClient.map((r) => (
                <li key={r.clientId} className="px-3 py-2 flex justify-between">
                  <span className="text-navy-900">{r.clientName}</span>
                  <span className="text-navy-700">
                    {r.totalHours}h · {r.visitCount} visits
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'incidents') {
    const d = data as {
      total: number;
      rows: { id: string; createdAt: string; clientName: string; severity: string; status: string; category: string }[];
      bySeverity: Record<string, number>;
      byStatus: Record<string, number>;
    };
    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-navy-100 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-navy-900 mb-2">By severity</h3>
            <ul className="text-sm text-navy-800 space-y-1">
              {Object.entries(d.bySeverity).map(([k, v]) => (
                <li key={k}>
                  {k}: <span className="font-semibold">{v}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-navy-100 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-navy-900 mb-2">By status</h3>
            <ul className="text-sm text-navy-800 space-y-1">
              {Object.entries(d.byStatus).map(([k, v]) => (
                <li key={k}>
                  {k}: <span className="font-semibold">{v}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="rounded-2xl border border-navy-100 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-2 border-b text-sm text-navy-800">
            <span className="font-semibold text-navy-900">{d.total}</span> incidents (rows capped for display)
          </div>
          <div className="overflow-x-auto max-h-[20rem]">
            <table className="min-w-full text-sm">
              <thead className="bg-navy-50 text-left text-xs uppercase text-navy-700">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Severity</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {d.rows.slice(0, 300).map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 whitespace-nowrap text-navy-700">{format(new Date(r.createdAt), 'dd MMM yyyy HH:mm')}</td>
                    <td className="px-3 py-2">{r.clientName}</td>
                    <td className="px-3 py-2">{r.severity}</td>
                    <td className="px-3 py-2">{r.status}</td>
                    <td className="px-3 py-2 text-navy-700">{r.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'payroll') {
    const d = data as {
      totals: { count: number; grossPay: number; hoursWorked: number; netPayTotal: number };
      byCarer: { carerId: string; carerName: string; payslipCount: number; grossPay: number; hoursWorked: number }[];
    };
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Payslips" value={String(d.totals.count)} />
          <Stat label="Hours" value={String(d.totals.hoursWorked)} />
          <Stat label="Gross pay" value={`£${d.totals.grossPay.toFixed(2)}`} />
          <Stat label="Net pay" value={`£${d.totals.netPayTotal.toFixed(2)}`} />
        </div>
        <div className="rounded-2xl border border-navy-100 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-2 border-b text-sm font-medium text-navy-900">By carer</div>
          <ul className="divide-y divide-navy-100 max-h-72 overflow-y-auto text-sm">
            {d.byCarer.map((r) => (
              <li key={r.carerId} className="px-3 py-2 flex justify-between gap-4">
                <span className="text-navy-900">{r.carerName}</span>
                <span className="text-navy-700 whitespace-nowrap">
                  {r.payslipCount} payslips · {r.hoursWorked}h · £{r.grossPay.toFixed(2)} gross
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-navy-600">{label}</div>
      <div className="text-xl font-semibold text-navy-900 mt-0.5">{value}</div>
    </div>
  );
}
