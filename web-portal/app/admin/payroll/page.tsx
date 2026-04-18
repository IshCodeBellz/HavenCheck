'use client';

import { useCallback, useEffect, useState } from 'react';
import { format, subDays } from 'date-fns';
import { apiV1 } from '@/lib/api-v1';

type PayslipStatus = 'DRAFT' | 'FINALIZED' | 'PAID';

type PayslipListItem = {
  id: string;
  carer: { id: string; name: string; email: string };
  periodStart: string;
  periodEnd: string;
  hoursWorked: number;
  mileageMiles: number;
  mileagePay: number;
  holidayAccruedHours: number;
  grossPay: number;
  expenseReimbursementTotal?: number;
  netPayTotal?: number;
  status: PayslipStatus;
};

type LineItem = {
  visitId?: string;
  clientName?: string;
  hoursWorked?: number;
  mileageMiles?: number;
  mileagePay?: number;
  mileageSource?: string;
  basePay?: number;
};

type ExpenseRow = { description: string; amount: number };

type PayslipDetail = PayslipListItem & {
  lineItems: unknown;
  expenseReimbursements?: ExpenseRow[] | unknown;
};

export default function AdminPayrollPage() {
  const [periodStart, setPeriodStart] = useState(format(subDays(new Date(), 14), "yyyy-MM-dd'T'00:00:00.000'Z'"));
  const [periodEnd, setPeriodEnd] = useState(format(new Date(), "yyyy-MM-dd'T'23:59:59.999'Z'"));
  const [payslips, setPayslips] = useState<PayslipListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PayslipDetail | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visitIdMiles, setVisitIdMiles] = useState('');
  const [milesValue, setMilesValue] = useState('');
  const [savingMiles, setSavingMiles] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiV1.get<PayslipListItem[]>('/payroll/payslips');
      setPayslips(res.data);
    } catch {
      setError('Failed to load payslips');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setExpenses([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiV1.get<PayslipDetail>(`/payroll/payslips/${selectedId}`);
        if (cancelled) return;
        setDetail(res.data);
        const raw = res.data.expenseReimbursements;
        setExpenses(Array.isArray(raw) ? (raw as ExpenseRow[]) : []);
      } catch {
        if (!cancelled) {
          setDetail(null);
          setExpenses([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const generatePayslips = async () => {
    setGenerating(true);
    setError(null);
    try {
      await apiV1.post('/payroll/payslips/generate', { periodStart, periodEnd });
      await load();
    } catch {
      setError('Failed to generate payslips');
    } finally {
      setGenerating(false);
    }
  };

  const downloadCsv = async (payslipId: string) => {
    try {
      const res = await apiV1.get(`/payroll/payslips/${payslipId}/export/csv`, { responseType: 'blob' });
      const href = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `payslip-${payslipId}.csv`;
      a.click();
      URL.revokeObjectURL(href);
    } catch {
      setError('Failed to export payroll CSV');
    }
  };

  const saveExpenses = async () => {
    if (!selectedId || !detail || detail.status !== 'DRAFT') return;
    setError(null);
    try {
      const res = await apiV1.patch<PayslipDetail>(`/payroll/payslips/${selectedId}`, { expenseReimbursements: expenses });
      setDetail(res.data);
      await load();
    } catch {
      setError('Could not save expenses');
    }
  };

  const patchStatus = async (status: PayslipStatus) => {
    if (!selectedId) return;
    setError(null);
    try {
      const res = await apiV1.patch<PayslipDetail>(`/payroll/payslips/${selectedId}`, { status });
      setDetail(res.data);
      await load();
    } catch {
      setError('Could not update payslip status');
    }
  };

  const applyMileageOverride = async (clear: boolean) => {
    const id = visitIdMiles.trim();
    if (!id) {
      setError('Enter a visit ID');
      return;
    }
    setSavingMiles(true);
    setError(null);
    try {
      await apiV1.patch(`/payroll/visits/${id}/mileage-override`, {
        mileageMilesOverride: clear ? null : Number(milesValue),
      });
      setVisitIdMiles('');
      setMilesValue('');
    } catch {
      setError('Could not update visit mileage (visit must belong to your organization).');
    } finally {
      setSavingMiles(false);
    }
  };

  const lineRows: LineItem[] = Array.isArray(detail?.lineItems) ? (detail!.lineItems as LineItem[]) : [];

  const addExpenseRow = () => setExpenses((prev) => [...prev, { description: '', amount: 0 }]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-navy-900">Payroll</h2>
        <p className="text-sm text-navy-800/70 mt-1">
          Payslips from completed visits: GPS mileage per visit, optional reported mileage override, expense reimbursements, then finalize and mark
          paid.
        </p>
      </div>

      <section className="rounded-xl border border-navy-100 bg-white p-4 space-y-2">
        <h3 className="text-sm font-semibold text-navy-900">Visit mileage override</h3>
        <p className="text-xs text-navy-700">
          When set, payroll uses reported miles for that visit instead of distance from GPS coordinates. Regenerate payslips after changing overrides.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm text-navy-800">
            Visit ID
            <input className="block mt-1 rounded-lg border border-navy-200 px-3 py-2 font-mono text-xs min-w-[14rem]" value={visitIdMiles} onChange={(e) => setVisitIdMiles(e.target.value)} />
          </label>
          <label className="text-sm text-navy-800">
            Miles
            <input className="block mt-1 rounded-lg border border-navy-200 px-3 py-2 w-24" value={milesValue} onChange={(e) => setMilesValue(e.target.value)} type="number" min={0} step="0.1" />
          </label>
          <button
            type="button"
            disabled={savingMiles}
            onClick={() => applyMileageOverride(false)}
            className="rounded-lg bg-navy-700 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            Save override
          </button>
          <button type="button" disabled={savingMiles} onClick={() => applyMileageOverride(true)} className="rounded-lg border border-navy-300 px-3 py-2 text-sm disabled:opacity-50">
            Clear override
          </button>
        </div>
      </section>

      <div className="rounded-xl border border-navy-100 bg-white p-4 flex flex-wrap items-end gap-3">
        <label className="text-sm text-navy-800">
          Period start (UTC ISO)
          <input className="block mt-1 rounded-lg border border-navy-200 px-3 py-2 min-w-[20rem]" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </label>
        <label className="text-sm text-navy-800">
          Period end (UTC ISO)
          <input className="block mt-1 rounded-lg border border-navy-200 px-3 py-2 min-w-[20rem]" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </label>
        <button type="button" onClick={generatePayslips} disabled={generating} className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50">
          {generating ? 'Generating…' : 'Generate payslips'}
        </button>
        <button type="button" onClick={load} disabled={loading} className="rounded-lg border border-navy-300 px-4 py-2 text-sm font-medium text-navy-900 hover:bg-navy-50 disabled:opacity-50">
          Refresh
        </button>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-navy-50 text-left text-navy-800">
              <tr>
                <th className="px-3 py-2">Payslip</th>
                <th className="px-3 py-2">Carer</th>
                <th className="px-3 py-2">Hours</th>
                <th className="px-3 py-2">Mileage</th>
                <th className="px-3 py-2">Net pay</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">CSV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {payslips.map((payslip) => (
                <tr
                  key={payslip.id}
                  className={selectedId === payslip.id ? 'bg-navy-50/80' : 'cursor-pointer hover:bg-navy-50/40'}
                  onClick={() => setSelectedId(payslip.id)}
                >
                  <td className="px-3 py-2 font-mono text-xs">{payslip.id.slice(0, 12)}</td>
                  <td className="px-3 py-2">{payslip.carer.name}</td>
                  <td className="px-3 py-2">{payslip.hoursWorked.toFixed(2)}</td>
                  <td className="px-3 py-2">{payslip.mileageMiles.toFixed(2)} mi</td>
                  <td className="px-3 py-2">£{(payslip.netPayTotal ?? payslip.grossPay).toFixed(2)}</td>
                  <td className="px-3 py-2">{payslip.status}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadCsv(payslip.id);
                      }}
                      className="rounded border border-navy-300 px-2 py-1 hover:bg-navy-50"
                    >
                      CSV
                    </button>
                  </td>
                </tr>
              ))}
              {payslips.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-navy-700">
                    No payslips yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-navy-100 bg-white p-4 space-y-3 min-h-[18rem]">
          <h3 className="text-sm font-semibold text-navy-900">Payslip detail</h3>
          {!selectedId && <p className="text-sm text-navy-600">Select a payslip for line items, mileage source, expenses, and run status.</p>}
          {selectedId && !detail && <p className="text-sm text-navy-600">Loading…</p>}
          {detail && (
            <>
              <p className="text-sm text-navy-800">
                {detail.carer.name} · {format(new Date(detail.periodStart), 'yyyy-MM-dd')} – {format(new Date(detail.periodEnd), 'yyyy-MM-dd')}
              </p>
              <div className="text-sm text-navy-800 space-y-0.5">
                <p>Gross (hours + mileage): £{detail.grossPay.toFixed(2)}</p>
                <p>Expense reimbursements: £{(detail.expenseReimbursementTotal ?? 0).toFixed(2)}</p>
                <p className="font-semibold">Net pay: £{(detail.netPayTotal ?? detail.grossPay).toFixed(2)}</p>
                <p>Status: {detail.status}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {detail.status === 'DRAFT' && (
                  <>
                    <button type="button" className="rounded-lg bg-navy-700 px-3 py-1.5 text-xs text-white" onClick={() => patchStatus('FINALIZED')}>
                      Finalize run
                    </button>
                    <button type="button" className="rounded-lg border border-navy-400 px-3 py-1.5 text-xs" onClick={() => patchStatus('PAID')}>
                      Mark paid
                    </button>
                  </>
                )}
                {detail.status === 'FINALIZED' && (
                  <button type="button" className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs text-white" onClick={() => patchStatus('PAID')}>
                    Mark paid
                  </button>
                )}
              </div>

              <div className="overflow-x-auto rounded-lg border border-navy-100 max-h-48 overflow-y-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-navy-50 text-left sticky top-0">
                    <tr>
                      <th className="px-2 py-1">Client</th>
                      <th className="px-2 py-1">Hours</th>
                      <th className="px-2 py-1">Mi</th>
                      <th className="px-2 py-1">Source</th>
                      <th className="px-2 py-1">Mile £</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineRows.map((row, i) => (
                      <tr key={i} className="border-t border-navy-100">
                        <td className="px-2 py-1">{row.clientName}</td>
                        <td className="px-2 py-1">{row.hoursWorked?.toFixed?.(2) ?? row.hoursWorked}</td>
                        <td className="px-2 py-1">{row.mileageMiles?.toFixed?.(2) ?? row.mileageMiles}</td>
                        <td className="px-2 py-1">{row.mileageSource ?? '—'}</td>
                        <td className="px-2 py-1">{Number(row.mileagePay ?? 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {detail.status === 'DRAFT' && (
                <div className="space-y-2 border-t border-navy-100 pt-3">
                  <p className="text-xs font-medium text-navy-800">Expense reimbursements</p>
                  {expenses.map((row, idx) => (
                    <div key={idx} className="flex flex-wrap gap-2 items-center">
                      <input
                        className="rounded border border-navy-200 px-2 py-1 text-xs flex-1 min-w-[8rem]"
                        placeholder="Description"
                        value={row.description}
                        onChange={(e) => setExpenses((prev) => prev.map((r, i) => (i === idx ? { ...r, description: e.target.value } : r)))}
                      />
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="rounded border border-navy-200 px-2 py-1 text-xs w-24"
                        value={row.amount}
                        onChange={(e) => setExpenses((prev) => prev.map((r, i) => (i === idx ? { ...r, amount: Number(e.target.value) } : r)))}
                      />
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button type="button" className="text-xs rounded border border-navy-300 px-2 py-1" onClick={addExpenseRow}>
                      Add row
                    </button>
                    <button type="button" className="text-xs rounded bg-navy-700 text-white px-3 py-1" onClick={saveExpenses}>
                      Save expenses
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
