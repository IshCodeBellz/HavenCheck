'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';
import Layout from '@/components/Layout';
import { apiV1 } from '@/lib/api-v1';
import { useRequireStaff } from '@/hooks/useRequireStaff';

type ScheduleRow = {
  id: string;
  startTime: string;
  endTime: string;
  client: { name: string };
  carer: { id: string; name: string };
  travelDistanceMiles?: number | null;
  travelDurationMinutes?: number | null;
};

interface RotaResponse {
  weekStart: string;
  schedules: Record<string, ScheduleRow[]>;
}

type TeamMember = {
  user: {
    id: string;
    name: string;
    role: string;
    isActive: boolean;
  };
};

type Team = {
  id: string;
  members: TeamMember[];
};

type CandidateSuggestion = {
  carerId: string;
  carerName: string;
  score: number;
  isAvailable: boolean;
  skillsEligible: boolean;
  missingCertifications: string[];
  missingDbs: boolean;
  preferredClient: boolean;
};

function mondayOfWeek(d: Date): Date {
  return startOfWeek(d, { weekStartsOn: 1 });
}

export default function ManagerTeamRotaPage() {
  const staffOk = useRequireStaff();
  const [weekAnchor, setWeekAnchor] = useState(() => mondayOfWeek(new Date()));
  const [data, setData] = useState<RotaResponse | null>(null);
  const [carers, setCarers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingScheduleId, setDraggingScheduleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<CandidateSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const startParam = format(weekAnchor, 'yyyy-MM-dd');

  const loadCarers = useCallback(async () => {
    const res = await apiV1.get<Team[]>('/manager/teams/me');
    const memberMap = new Map<string, string>();
    for (const team of res.data) {
      for (const member of team.members) {
        if (member.user.role === 'CARER' && member.user.isActive) {
          memberMap.set(member.user.id, member.user.name);
        }
      }
    }
    setCarers(Array.from(memberMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)));
  }, []);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiV1.get<RotaResponse>('/manager/team-rota/week', {
        params: { start: startParam },
      });
      setData(res.data);
      if (carers.length === 0) {
        await loadCarers();
      }
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e !== null && 'response' in e
          ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message)
          : null;
      setError(msg || 'Failed to load team rota');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [startParam, carers.length, loadCarers]);

  const loadSuggestions = useCallback(async (scheduleId: string) => {
    try {
      const res = await apiV1.get<CandidateSuggestion[]>(`/manager/team-rota/suggestions/${scheduleId}`);
      setSuggestions(res.data);
    } catch {
      setSuggestions([]);
    }
  }, []);

  useEffect(() => {
    if (staffOk) load();
  }, [staffOk, load]);

  const dayKeys = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => format(addDays(weekAnchor, i), 'yyyy-MM-dd'));
  }, [weekAnchor]);

  const board = useMemo(() => {
    const byCarerDay: Record<string, Record<string, ScheduleRow[]>> = {};
    for (const c of carers) {
      byCarerDay[c.id] = {};
      for (const day of dayKeys) byCarerDay[c.id][day] = [];
    }
    if (!data) return byCarerDay;
    for (const day of dayKeys) {
      const slots = data.schedules[day] || [];
      for (const slot of slots) {
        if (!byCarerDay[slot.carer.id]) {
          byCarerDay[slot.carer.id] = {};
          for (const d of dayKeys) byCarerDay[slot.carer.id][d] = [];
        }
        byCarerDay[slot.carer.id][day].push(slot);
      }
    }
    for (const carerId of Object.keys(byCarerDay)) {
      for (const day of dayKeys) {
        byCarerDay[carerId][day].sort(
          (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );
      }
    }
    return byCarerDay;
  }, [carers, dayKeys, data]);

  const moveSchedule = useCallback(
    async (scheduleId: string, targetCarerId: string) => {
      setError(null);
      setSaving(true);
      try {
        await apiV1.patch(`/manager/team-rota/reassign/${scheduleId}`, { carerId: targetCarerId });
        await load();
      } catch (e: unknown) {
        const msg =
          typeof e === 'object' && e !== null && 'response' in e
            ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message)
            : null;
        setError(msg || 'Unable to move shift. Conflict, skills, or availability check failed.');
      } finally {
        setSaving(false);
        setDraggingScheduleId(null);
      }
    },
    [load]
  );

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-navy-900">Team rota</h1>
          <p className="text-sm text-navy-800/70 mt-1">
            Week of {format(weekAnchor, 'MMM d, yyyy')} ·{' '}
            <code className="text-xs bg-navy-100 px-1 rounded">GET /api/v1/manager/team-rota/week</code>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekAnchor((d) => addDays(d, -7))}
            className="cursor-pointer px-3 py-2 rounded-lg border border-navy-200 text-sm text-navy-800 hover:bg-navy-50"
          >
            Previous week
          </button>
          <button
            type="button"
            onClick={() => setWeekAnchor(mondayOfWeek(new Date()))}
            className="cursor-pointer px-3 py-2 rounded-lg border border-navy-200 text-sm text-navy-800 hover:bg-navy-50"
          >
            This week
          </button>
          <button
            type="button"
            onClick={() => setWeekAnchor((d) => addDays(d, 7))}
            className="cursor-pointer px-3 py-2 rounded-lg border border-navy-200 text-sm text-navy-800 hover:bg-navy-50"
          >
            Next week
          </button>
          <button
            type="button"
            onClick={load}
            className="cursor-pointer px-4 py-2 rounded-xl bg-navy-600 text-white text-sm font-medium shadow-sm hover:bg-navy-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && (
        <p role="status" className="text-navy-800">
          Loading…
        </p>
      )}
      {error && <p className="text-red-700 mb-4">{error}</p>}

      {saving && <p className="text-sm text-navy-700 mb-3">Applying assignment change…</p>}

      {!loading && data && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white">
            <div className="min-w-[1050px]">
              <div className="grid grid-cols-[220px_repeat(7,minmax(120px,1fr))] border-b border-navy-100 bg-navy-50/60">
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-navy-700">Carer</div>
                {dayKeys.map((day) => (
                  <div key={day} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-navy-700">
                    {format(new Date(`${day}T12:00:00`), 'EEE d')}
                  </div>
                ))}
              </div>
              {carers.map((carer) => (
                <div
                  key={carer.id}
                  className="grid grid-cols-[220px_repeat(7,minmax(120px,1fr))] border-b border-navy-100 last:border-b-0"
                >
                  <div className="px-3 py-3 text-sm font-medium text-navy-900 bg-navy-50/30">{carer.name}</div>
                  {dayKeys.map((day) => (
                    <div
                      key={`${carer.id}-${day}`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (draggingScheduleId) void moveSchedule(draggingScheduleId, carer.id);
                      }}
                      className="min-h-[88px] p-2 border-l border-navy-100 bg-white"
                    >
                      <div className="space-y-2">
                        {(board[carer.id]?.[day] || []).map((s) => (
                          <button
                            key={s.id}
                            draggable
                            type="button"
                            onDragStart={() => setDraggingScheduleId(s.id)}
                            onDragEnd={() => setDraggingScheduleId(null)}
                            onClick={() => {
                              setSelectedScheduleId(s.id);
                              void loadSuggestions(s.id);
                            }}
                            className="w-full text-left text-xs rounded-lg border border-navy-100 bg-navy-50/70 px-2 py-2 shadow-sm hover:bg-navy-100"
                          >
                            <div className="font-semibold text-navy-900">{s.client.name}</div>
                            <div className="text-navy-700">
                              {format(new Date(s.startTime), 'HH:mm')}–{format(new Date(s.endTime), 'HH:mm')}
                            </div>
                            {typeof s.travelDistanceMiles === 'number' && (
                              <div className="text-[11px] text-navy-600 mt-1">
                                {s.travelDistanceMiles.toFixed(1)} mi · {s.travelDurationMinutes ?? '-'} min travel
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-navy-100 bg-white p-4">
            <h2 className="text-sm font-semibold text-navy-900">Availability + Skills recommendations</h2>
            <p className="text-xs text-navy-700 mt-1 mb-3">
              Select any shift card to see ranked carers based on availability, DBS/certifications, and preferences.
            </p>
            {!selectedScheduleId ? (
              <p className="text-xs text-navy-700">No shift selected.</p>
            ) : suggestions.length === 0 ? (
              <p className="text-xs text-navy-700">No recommendation data available.</p>
            ) : (
              <ul className="space-y-2">
                {suggestions.slice(0, 6).map((s) => (
                  <li key={s.carerId} className="text-xs border border-navy-100 rounded-lg p-2">
                    <div className="font-medium text-navy-900">
                      {s.carerName} <span className="text-navy-600">({s.score})</span>
                    </div>
                    <div className="text-navy-700">
                      {s.isAvailable ? 'Available' : 'Has overlap'} · {s.skillsEligible ? 'Skills OK' : 'Skills mismatch'}
                      {s.preferredClient ? ' · Preferred client' : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
