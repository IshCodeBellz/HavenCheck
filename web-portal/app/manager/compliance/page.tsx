'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import Layout from '@/components/Layout';
import { apiV1 } from '@/lib/api-v1';
import { useRequireStaff } from '@/hooks/useRequireStaff';

interface ComplianceDashboard {
  period: { from: string; to: string };
  incidents: {
    inPeriod: number;
    open: number;
    safeguardingOpen: number;
    bySeverity: Record<string, number>;
    byStatus: Record<string, number>;
    recent: Array<{
      id: string;
      category: string;
      severity: string;
      status: string;
      safeguardingFlag: boolean;
      createdAt: string;
      client: { name: string };
    }>;
  };
  medication: {
    administered: number;
    omitted: number;
    complianceRatePercent: number | null;
  };
  visits: { missed: number; incomplete: number; late: number };
  riskAlerts: {
    unacknowledgedMedicationAlerts: number;
    highRiskAssessmentsInPeriod: number;
    overdueActiveCarePlanReviews: number;
  };
}

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

export default function ManagerCompliancePage() {
  const staffOk = useRequireStaff();
  const defaultTo = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const defaultFrom = useMemo(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'), []);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [data, setData] = useState<ComplianceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiV1.get<ComplianceDashboard>('/manager/compliance/dashboard', {
        params: { from, to },
      });
      setData(res.data);
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e !== null && 'response' in e
          ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message)
          : null;
      setError(msg || 'Failed to load compliance dashboard');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    if (staffOk) void load();
  }, [staffOk, load]);

  const runExport = async (key: string, params: Record<string, string>) => {
    setExporting(key);
    setError(null);
    try {
      const res = await apiV1.get('/manager/compliance/inspection-pack', {
        params: { from, to, ...params },
        responseType: 'blob',
      });
      const cd = res.headers['content-disposition'];
      const fallback =
        params.format === 'pdf' ? 'inspection-pack.pdf' : params.include?.includes(',') ? 'inspection-pack.zip' : 'export.csv';
      triggerDownload(res.data as Blob, filenameFromContentDisposition(cd, fallback));
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
      setExporting(null);
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

  return (
    <Layout>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-navy-900">Compliance</h1>
          <p className="text-sm text-navy-800/70 mt-1 max-w-xl">
            Inspection readiness: incident and medication indicators, missed visits, risk signals, and exports for
            regulators.
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
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-navy-600 text-white text-sm font-medium shadow-sm hover:bg-navy-700 disabled:opacity-60"
          >
            {loading ? 'Loading…' : 'Apply range'}
          </button>
        </div>
      </div>

      {error ? <p className="text-red-700 mb-4">{error}</p> : null}

      <section className="mb-10 rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-navy-900 mb-4">Inspection pack</h2>
        <p className="text-sm text-navy-800/75 mb-4">
          CSV: single file for one dataset, or a ZIP containing incidents, medication logs, and care plans when multiple
          are selected. PDF combines the same datasets for a printable pack.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!!exporting}
            onClick={() => void runExport('zip', { format: 'csv', include: 'incidents,medications,care_plans' })}
            className="px-4 py-2 rounded-xl border border-navy-200 text-sm font-medium text-navy-900 hover:bg-navy-50 disabled:opacity-50"
          >
            {exporting === 'zip' ? 'Preparing…' : 'CSV bundle (ZIP)'}
          </button>
          <button
            type="button"
            disabled={!!exporting}
            onClick={() => void runExport('pdf', { format: 'pdf' })}
            className="px-4 py-2 rounded-xl bg-navy-600 text-white text-sm font-medium hover:bg-navy-700 disabled:opacity-50"
          >
            {exporting === 'pdf' ? 'Preparing…' : 'PDF pack'}
          </button>
          <button
            type="button"
            disabled={!!exporting}
            onClick={() => void runExport('inc', { format: 'csv', include: 'incidents' })}
            className="px-3 py-2 rounded-xl border border-navy-100 text-xs font-medium text-navy-800 hover:bg-navy-50 disabled:opacity-50"
          >
            Incidents CSV
          </button>
          <button
            type="button"
            disabled={!!exporting}
            onClick={() => void runExport('med', { format: 'csv', include: 'medications' })}
            className="px-3 py-2 rounded-xl border border-navy-100 text-xs font-medium text-navy-800 hover:bg-navy-50 disabled:opacity-50"
          >
            Medication logs CSV
          </button>
          <button
            type="button"
            disabled={!!exporting}
            onClick={() => void runExport('cp', { format: 'csv', include: 'care_plans' })}
            className="px-3 py-2 rounded-xl border border-navy-100 text-xs font-medium text-navy-800 hover:bg-navy-50 disabled:opacity-50"
          >
            Care plans CSV
          </button>
        </div>
      </section>

      {loading && !data ? (
        <p role="status" className="text-navy-800">
          Loading…
        </p>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-navy-800/60">Incidents (period)</div>
              <div className="text-3xl font-bold text-navy-900 mt-1">{data.incidents.inPeriod}</div>
              <div className="text-sm text-navy-800/75 mt-2">
                {data.incidents.open} open overall · {data.incidents.safeguardingOpen} open with safeguarding flag
              </div>
            </div>
            <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-navy-800/60">Medication compliance</div>
              <div className="text-3xl font-bold text-navy-900 mt-1">
                {data.medication.complianceRatePercent !== null ? `${data.medication.complianceRatePercent}%` : '—'}
              </div>
              <div className="text-sm text-navy-800/75 mt-2">
                {data.medication.administered} administered · {data.medication.omitted} omitted (period)
              </div>
            </div>
            <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-navy-800/60">Missed visits</div>
              <div className="text-3xl font-bold text-navy-900 mt-1">{data.visits.missed}</div>
              <div className="text-sm text-navy-800/75 mt-2">
                {data.visits.incomplete} incomplete · {data.visits.late} late (scheduled in range)
              </div>
            </div>
            <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-navy-800/60">Risk alerts</div>
              <div className="text-3xl font-bold text-navy-900 mt-1">
                {data.riskAlerts.unacknowledgedMedicationAlerts +
                  data.riskAlerts.highRiskAssessmentsInPeriod +
                  data.riskAlerts.overdueActiveCarePlanReviews}
              </div>
              <div className="text-sm text-navy-800/75 mt-2 space-y-0.5">
                <div>{data.riskAlerts.unacknowledgedMedicationAlerts} unacknowledged med alerts (period)</div>
                <div>{data.riskAlerts.highRiskAssessmentsInPeriod} HIGH risk assessments (period)</div>
                <div>{data.riskAlerts.overdueActiveCarePlanReviews} active care plans past review date</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-navy-900 mb-3">Incidents by severity</h3>
              <ul className="text-sm text-navy-800 space-y-1">
                {Object.entries(data.incidents.bySeverity).map(([k, v]) => (
                  <li key={k}>
                    {k}: <span className="font-semibold">{v}</span>
                  </li>
                ))}
              </ul>
              <h3 className="text-base font-semibold text-navy-900 mt-6 mb-3">By status</h3>
              <ul className="text-sm text-navy-800 space-y-1">
                {Object.entries(data.incidents.byStatus).map(([k, v]) => (
                  <li key={k}>
                    {k}: <span className="font-semibold">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-navy-900 mb-3">Recent incidents</h3>
              <ul className="divide-y divide-navy-100 text-sm">
                {data.incidents.recent.map((i) => (
                  <li key={i.id} className="py-3 first:pt-0">
                    <div className="font-medium text-navy-900">{i.client.name}</div>
                    <div className="text-navy-800/80">
                      {format(new Date(i.createdAt), 'dd MMM yyyy HH:mm')} · {i.severity} · {i.status}
                      {i.safeguardingFlag ? ' · Safeguarding' : ''}
                    </div>
                    <div className="text-navy-800/70 text-xs mt-0.5">{i.category}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      ) : null}
    </Layout>
  );
}
