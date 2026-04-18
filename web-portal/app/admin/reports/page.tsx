'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiV1 } from '@/lib/api-v1';

type ReportMetric = {
  key: string;
  value: number;
};

const LABELS: Record<string, string> = {
  missed_visits: 'Missed visits',
  med_compliance: 'Medication compliance',
  hours_delivered: 'Hours delivered',
  total_hours: 'Total hours',
  revenue: 'Revenue (invoiced)',
  payroll_costs: 'Payroll costs',
  completed_visits: 'Completed visits',
  late_visits: 'Late visits',
  med_administered: 'Medications administered',
  med_omitted: 'Medications omitted',
  incident_count: 'Incidents',
  active_clients: 'Active clients',
  visit_completion_rate: 'Visit completion rate',
};

function formatMetric(key: string, value: number): string {
  if (key === 'revenue' || key === 'payroll_costs') {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 }).format(value);
  }
  if (key === 'med_compliance' || key === 'visit_completion_rate') {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (key === 'total_hours' || key === 'hours_delivered') {
    return value.toFixed(2);
  }
  if (value < 1 && value > 0 && !Number.isInteger(value)) {
    return value.toFixed(2);
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export default function AdminReportsPage() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportMetric[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiV1.get<{ reports: ReportMetric[] }>('/admin/reports/enterprise', {
        params: {
          from: from || undefined,
          to: to || undefined,
        },
      });
      setReports(response.data.reports);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-navy-900">Enterprise reports</h2>
        <p className="text-sm text-navy-700">
          High-level KPIs for the selected visit window (scheduled start) and medication events (administered time).
        </p>
        <p className="text-sm text-navy-800 mt-2">
          <Link href="/manager/reports" className="font-medium text-navy-600 hover:underline">
            Detailed operational reports
          </Link>{' '}
          (missed visits, medication compliance, hours delivered, incidents, payroll summary) include filters and CSV
          export. Admins can open the same tools there; data is scoped to your organisation.
        </p>
      </div>

      <div className="rounded-xl border border-navy-100 bg-white p-4 flex flex-wrap items-end gap-3">
        <label className="text-sm text-navy-800">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="block mt-1 rounded-lg border border-navy-200 px-3 py-2" />
        </label>
        <label className="text-sm text-navy-800">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="block mt-1 rounded-lg border border-navy-200 px-3 py-2" />
        </label>
        <button type="button" onClick={load} className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800">
          Refresh reports
        </button>
      </div>

      {loading ? (
        <p className="text-navy-700">Loading reports...</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((item) => (
            <div key={item.key} className="rounded-xl border border-navy-100 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-navy-600">{LABELS[item.key] ?? item.key.replaceAll('_', ' ')}</p>
              <p className="mt-1 text-2xl font-semibold text-navy-900">{formatMetric(item.key, item.value)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
