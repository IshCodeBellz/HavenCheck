'use client';

import { useCallback, useEffect, useState } from 'react';
import { format, subDays } from 'date-fns';
import { apiV1 } from '@/lib/api-v1';

type ClientOption = { id: string; name: string };

type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'VOID';

type RateCard = {
  id: string;
  name: string;
  clientId: string | null;
  client?: { id: string; name: string } | null;
  billingRateType: 'HOURLY' | 'FIXED';
  billingHourlyRate: number | null;
  billingFixedRate: number | null;
  payrollHourlyRate: number;
  mileageRatePerMile: number;
  billingModifiers?: { weekendHourlyMultiplier?: number } | null;
  active: boolean;
};

type InvoiceListItem = {
  id: string;
  client: { id: string; name: string };
  subtotal: number;
  total: number;
  currency: string;
  status: InvoiceStatus;
  periodStart: string;
  periodEnd: string;
  dueAt: string;
  createdAt: string;
};

type InvoiceDetail = InvoiceListItem & {
  lineItems: unknown;
  rateCard?: { id: string; name: string; billingRateType: string; billingModifiers?: unknown } | null;
};

function invoiceStatusLabel(s: string): string {
  if (s === 'ISSUED') return 'Sent';
  if (s === 'DRAFT') return 'Draft';
  if (s === 'PAID') return 'Paid';
  if (s === 'VOID') return 'Void';
  return s;
}

export default function AdminBillingPage() {
  const [periodStart, setPeriodStart] = useState(format(subDays(new Date(), 14), "yyyy-MM-dd'T'00:00:00.000'Z'"));
  const [periodEnd, setPeriodEnd] = useState(format(new Date(), "yyyy-MM-dd'T'23:59:59.999'Z'"));
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [rateCardId, setRateCardId] = useState('');
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rcName, setRcName] = useState('Client rate');
  const [rcClientId, setRcClientId] = useState('');
  const [rcType, setRcType] = useState<'HOURLY' | 'FIXED'>('HOURLY');
  const [rcBillHourly, setRcBillHourly] = useState('22');
  const [rcBillFixed, setRcBillFixed] = useState('45');
  const [rcPayHourly, setRcPayHourly] = useState('12.5');
  const [rcMileage, setRcMileage] = useState('0.45');
  const [rcWeekendMult, setRcWeekendMult] = useState('');
  const [savingRc, setSavingRc] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cardsRes, invoicesRes, clientsRes] = await Promise.all([
        apiV1.get<RateCard[]>('/billing/rate-cards'),
        apiV1.get<InvoiceListItem[]>('/billing/invoices', {
          params: statusFilter ? { status: statusFilter } : undefined,
        }),
        apiV1.get<ClientOption[]>('/manager/clients').catch(() => ({ data: [] as ClientOption[] })),
      ]);
      setRateCards(cardsRes.data);
      setInvoices(invoicesRes.data);
      setClients(Array.isArray(clientsRes.data) ? clientsRes.data : []);
    } catch {
      setError('Failed to load billing data');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setInvoiceDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiV1.get<InvoiceDetail>(`/billing/invoices/${selectedId}`);
        if (!cancelled) setInvoiceDetail(res.data);
      } catch {
        if (!cancelled) setInvoiceDetail(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const generateInvoices = async () => {
    setGenerating(true);
    setError(null);
    try {
      await apiV1.post('/billing/invoices/generate', {
        periodStart,
        periodEnd,
        rateCardId: rateCardId || undefined,
      });
      await load();
    } catch {
      setError('Failed to generate invoices');
    } finally {
      setGenerating(false);
    }
  };

  const downloadXeroCsv = async (invoiceId: string) => {
    try {
      const res = await apiV1.get(`/billing/invoices/${invoiceId}/export/xero`, { responseType: 'blob' });
      const href = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `invoice-${invoiceId}-xero.csv`;
      a.click();
      URL.revokeObjectURL(href);
    } catch {
      setError('Failed to export invoice CSV');
    }
  };

  const patchInvoiceStatus = async (status: InvoiceStatus) => {
    if (!selectedId) return;
    setError(null);
    try {
      const res = await apiV1.patch<InvoiceDetail>(`/billing/invoices/${selectedId}`, { status });
      setInvoiceDetail(res.data);
      await load();
    } catch {
      setError('Could not update invoice status');
    }
  };

  const createRateCard = async () => {
    setSavingRc(true);
    setError(null);
    try {
      const weekend = rcWeekendMult.trim() ? Number(rcWeekendMult) : undefined;
      await apiV1.post('/billing/rate-cards', {
        name: rcName.trim(),
        clientId: rcClientId || null,
        billingRateType: rcType,
        billingHourlyRate: rcType === 'HOURLY' ? Number(rcBillHourly) : null,
        billingFixedRate: rcType === 'FIXED' ? Number(rcBillFixed) : null,
        payrollHourlyRate: Number(rcPayHourly),
        mileageRatePerMile: Number(rcMileage) || 0,
        billingModifiers: weekend && weekend > 0 ? { weekendHourlyMultiplier: weekend } : null,
      });
      await load();
    } catch {
      setError('Failed to create rate card');
    } finally {
      setSavingRc(false);
    }
  };

  const lineRows = Array.isArray(invoiceDetail?.lineItems) ? (invoiceDetail!.lineItems as Record<string, unknown>[]) : [];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-navy-900">Billing</h2>
        <p className="text-sm text-navy-800/70 mt-1">
          Client-specific rate cards (optional weekend billing multiplier), invoice generation, and draft → sent → paid lifecycle.
        </p>
      </div>

      <section className="rounded-xl border border-navy-100 bg-white p-4 space-y-3">
        <h3 className="text-sm font-semibold text-navy-900">Rate cards</h3>
        <p className="text-xs text-navy-700">
          Assign a card to a client for automatic resolution, or leave client blank for an organization default. Weekend multiplier applies to
          Saturday and Sunday (UTC) on generated invoice lines.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-navy-800">
            Name
            <input className="block mt-1 rounded-lg border border-navy-200 px-3 py-2 w-48" value={rcName} onChange={(e) => setRcName(e.target.value)} />
          </label>
          <label className="text-sm text-navy-800">
            Client (optional)
            <select className="block mt-1 rounded-lg border border-navy-200 px-3 py-2 min-w-[12rem]" value={rcClientId} onChange={(e) => setRcClientId(e.target.value)}>
              <option value="">Default (all clients)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-navy-800">
            Billing type
            <select className="block mt-1 rounded-lg border border-navy-200 px-3 py-2" value={rcType} onChange={(e) => setRcType(e.target.value as 'HOURLY' | 'FIXED')}>
              <option value="HOURLY">Hourly</option>
              <option value="FIXED">Fixed per visit</option>
            </select>
          </label>
          {rcType === 'HOURLY' ? (
            <label className="text-sm text-navy-800">
              Bill £/h
              <input className="block mt-1 rounded-lg border border-navy-200 px-3 py-2 w-24" value={rcBillHourly} onChange={(e) => setRcBillHourly(e.target.value)} />
            </label>
          ) : (
            <label className="text-sm text-navy-800">
              Bill £/visit
              <input className="block mt-1 rounded-lg border border-navy-200 px-3 py-2 w-24" value={rcBillFixed} onChange={(e) => setRcBillFixed(e.target.value)} />
            </label>
          )}
          <label className="text-sm text-navy-800">
            Payroll £/h
            <input className="block mt-1 rounded-lg border border-navy-200 px-3 py-2 w-24" value={rcPayHourly} onChange={(e) => setRcPayHourly(e.target.value)} />
          </label>
          <label className="text-sm text-navy-800">
            Mileage £/mi
            <input className="block mt-1 rounded-lg border border-navy-200 px-3 py-2 w-24" value={rcMileage} onChange={(e) => setRcMileage(e.target.value)} />
          </label>
          <label className="text-sm text-navy-800">
            Weekend × (optional)
            <input
              className="block mt-1 rounded-lg border border-navy-200 px-3 py-2 w-24"
              placeholder="e.g. 1.25"
              value={rcWeekendMult}
              onChange={(e) => setRcWeekendMult(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={createRateCard}
            disabled={savingRc}
            className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50"
          >
            {savingRc ? 'Saving…' : 'Add rate card'}
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-navy-100">
          <table className="min-w-full text-xs">
            <thead className="bg-navy-50 text-left text-navy-800">
              <tr>
                <th className="px-2 py-1">Name</th>
                <th className="px-2 py-1">Client</th>
                <th className="px-2 py-1">Type</th>
                <th className="px-2 py-1">Weekend ×</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {rateCards.map((c) => (
                <tr key={c.id}>
                  <td className="px-2 py-1">{c.name}</td>
                  <td className="px-2 py-1">{c.client?.name ?? '—'}</td>
                  <td className="px-2 py-1">{c.billingRateType}</td>
                  <td className="px-2 py-1">{c.billingModifiers?.weekendHourlyMultiplier ?? '—'}</td>
                </tr>
              ))}
              {rateCards.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-2 py-3 text-center text-navy-600">
                    No rate cards yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
        <label className="text-sm text-navy-800">
          Rate card (optional)
          <select className="block mt-1 rounded-lg border border-navy-200 px-3 py-2 min-w-[14rem]" value={rateCardId} onChange={(e) => setRateCardId(e.target.value)}>
            <option value="">Auto-select by client/default</option>
            {rateCards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name} ({card.billingRateType})
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={generateInvoices} disabled={generating} className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50">
          {generating ? 'Generating…' : 'Generate invoices'}
        </button>
        <button type="button" onClick={load} disabled={loading} className="rounded-lg border border-navy-300 px-4 py-2 text-sm font-medium text-navy-900 hover:bg-navy-50 disabled:opacity-50">
          Refresh
        </button>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-navy-100 px-3 py-2">
            <span className="text-sm font-medium text-navy-900">Invoices</span>
            <select className="text-sm rounded border border-navy-200 px-2 py-1" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="ISSUED">Sent</option>
              <option value="PAID">Paid</option>
              <option value="VOID">Void</option>
            </select>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-navy-50 text-left text-navy-800">
              <tr>
                <th className="px-3 py-2">Invoice</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Export</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className={selectedId === invoice.id ? 'bg-navy-50/80' : 'cursor-pointer hover:bg-navy-50/50'}
                  onClick={() => setSelectedId(invoice.id)}
                >
                  <td className="px-3 py-2 font-mono text-xs">{invoice.id.slice(0, 12)}</td>
                  <td className="px-3 py-2">{invoice.client.name}</td>
                  <td className="px-3 py-2">
                    {invoice.currency} {invoice.total.toFixed(2)}
                  </td>
                  <td className="px-3 py-2">{invoiceStatusLabel(invoice.status)}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadXeroCsv(invoice.id);
                      }}
                      className="rounded border border-navy-300 px-2 py-1 hover:bg-navy-50"
                    >
                      Xero CSV
                    </button>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-navy-700">
                    No invoices yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-navy-100 bg-white p-4 min-h-[16rem]">
          <h3 className="text-sm font-semibold text-navy-900 mb-2">Invoice detail</h3>
          {!selectedId && <p className="text-sm text-navy-600">Select an invoice to view lines and update status.</p>}
          {selectedId && !invoiceDetail && <p className="text-sm text-navy-600">Loading…</p>}
          {invoiceDetail && (
            <div className="space-y-3 text-sm">
              <p className="text-navy-800">
                <span className="font-medium">Client:</span> {invoiceDetail.client.name}
              </p>
              <p className="text-navy-800">
                <span className="font-medium">Period:</span> {format(new Date(invoiceDetail.periodStart), 'yyyy-MM-dd')} –{' '}
                {format(new Date(invoiceDetail.periodEnd), 'yyyy-MM-dd')}
              </p>
              <p className="text-navy-800">
                <span className="font-medium">Due:</span> {format(new Date(invoiceDetail.dueAt), 'yyyy-MM-dd')}
              </p>
              <p className="text-navy-800">
                <span className="font-medium">Status:</span> {invoiceStatusLabel(invoiceDetail.status)}
              </p>
              <div className="flex flex-wrap gap-2">
                {invoiceDetail.status === 'DRAFT' && (
                  <button type="button" className="rounded-lg bg-navy-700 px-3 py-1.5 text-white text-xs font-medium" onClick={() => patchInvoiceStatus('ISSUED')}>
                    Mark sent
                  </button>
                )}
                {invoiceDetail.status === 'ISSUED' && (
                  <button type="button" className="rounded-lg bg-emerald-700 px-3 py-1.5 text-white text-xs font-medium" onClick={() => patchInvoiceStatus('PAID')}>
                    Mark paid
                  </button>
                )}
                {(invoiceDetail.status === 'DRAFT' || invoiceDetail.status === 'ISSUED') && (
                  <button type="button" className="rounded-lg border border-navy-300 px-3 py-1.5 text-xs" onClick={() => patchInvoiceStatus('VOID')}>
                    Void
                  </button>
                )}
              </div>
              <div className="overflow-x-auto rounded-lg border border-navy-100 max-h-64 overflow-y-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-navy-50 text-left sticky top-0">
                    <tr>
                      <th className="px-2 py-1">Carer</th>
                      <th className="px-2 py-1">Qty</th>
                      <th className="px-2 py-1">Unit</th>
                      <th className="px-2 py-1">Line</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineRows.map((row, i) => (
                      <tr key={i} className="border-t border-navy-100">
                        <td className="px-2 py-1">{(row.carerName as string) ?? ''}</td>
                        <td className="px-2 py-1">{String(row.quantity ?? '')}</td>
                        <td className="px-2 py-1">{Number(row.unitAmount ?? 0).toFixed(2)}</td>
                        <td className="px-2 py-1">{Number(row.lineTotal ?? 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="font-medium text-navy-900">
                Total {invoiceDetail.currency} {invoiceDetail.total.toFixed(2)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
