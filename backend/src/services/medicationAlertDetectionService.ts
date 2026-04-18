import { MedicationAlertType, MedicationEventStatus, VisitStatus } from '@prisma/client';
import { subDays } from 'date-fns';
import { prisma } from '../lib/prisma';
import { combineDateWithTime, isScheduleDueDuringVisit } from '../lib/medicationDue';
import { medicationAlertService } from './medicationAlertService';

const VISIT_LOOKBACK_DAYS = 8;
const LATE_AFTER_SLOT_MINUTES = 30;
const PRN_WINDOW_HOURS = 12;
const PRN_MAX_DOSES_IN_WINDOW = 4;

function visitWindowInput(visit: {
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  clockInTime: Date | null;
}) {
  return {
    scheduledStart: visit.scheduledStart,
    scheduledEnd: visit.scheduledEnd,
    clockInTime: visit.clockInTime,
  };
}

function eventCoversSchedule(
  rows: { scheduleId: string | null; status: MedicationEventStatus; medicationId: string }[],
  medicationId: string,
  scheduleId: string
) {
  return rows.some(
    (e) =>
      e.medicationId === medicationId &&
      e.scheduleId === scheduleId &&
      (e.status === MedicationEventStatus.ADMINISTERED || e.status === MedicationEventStatus.OMITTED)
  );
}

export const medicationAlertDetectionService = {
  async runForAllOrganizations() {
    const orgs = await prisma.organization.findMany({ select: { id: true } });
    for (const org of orgs) {
      await this.runForOrganization(org.id);
    }
  },

  async runForOrganization(organizationId: string) {
    const since = subDays(new Date(), VISIT_LOOKBACK_DAYS);

    await this.detectMissedScheduledDuringClosedVisits(organizationId, since);
    await this.detectLateAdministrations(organizationId, since);
    await this.detectPrnMisuse(organizationId);
    await this.detectLowStock(organizationId);
  },

  async detectMissedScheduledDuringClosedVisits(organizationId: string, since: Date) {
    const visits = await prisma.visit.findMany({
      where: {
        client: { organizationId },
        clockInTime: { not: null, gte: since },
        OR: [
          { clockOutTime: { not: null } },
          { status: { in: [VisitStatus.COMPLETED, VisitStatus.MISSED, VisitStatus.INCOMPLETE] } },
        ],
      },
      select: {
        id: true,
        clientId: true,
        scheduledStart: true,
        scheduledEnd: true,
        clockInTime: true,
        clockOutTime: true,
        status: true,
      },
      take: 800,
      orderBy: { clockInTime: 'desc' },
    });

    if (visits.length === 0) return;

    const visitIds = visits.map((v) => v.id);
    const visitEvents = await prisma.medicationEvent.findMany({
      where: { organizationId, visitId: { in: visitIds }, deletedAt: null },
      select: { visitId: true, scheduleId: true, status: true, medicationId: true },
    });
    const eventsByVisit = new Map<string, typeof visitEvents>();
    for (const e of visitEvents) {
      const arr = eventsByVisit.get(e.visitId) ?? [];
      arr.push(e);
      eventsByVisit.set(e.visitId, arr);
    }

    const clientIds = [...new Set(visits.map((v) => v.clientId))];
    const medications = await prisma.medication.findMany({
      where: { organizationId, clientId: { in: clientIds }, active: true },
      include: { schedules: { where: { active: true, isPrn: false } } },
    });
    const medsByClient = new Map<string, typeof medications>();
    for (const m of medications) {
      const arr = medsByClient.get(m.clientId) ?? [];
      arr.push(m);
      medsByClient.set(m.clientId, arr);
    }

    for (const visit of visits) {
      const win = visitWindowInput(visit);
      const meds = medsByClient.get(visit.clientId) ?? [];
      const evs = eventsByVisit.get(visit.id) ?? [];

      for (const med of meds) {
        if (med.isPrn) continue;
        for (const schedule of med.schedules) {
          if (!isScheduleDueDuringVisit(win, schedule)) continue;
          if (eventCoversSchedule(evs, med.id, schedule.id)) continue;
          await medicationAlertService.tryCreateAndNotify({
            organizationId,
            type: MedicationAlertType.MISSED_MEDICATION,
            medicationId: med.id,
            clientId: med.clientId,
            visitId: visit.id,
            scheduleId: schedule.id,
            dedupeKey: `MISSED:${visit.id}:${schedule.id}`,
            title: 'Missed scheduled medication',
            detail: `${med.name} was due during a visit (${schedule.timeOfDay}) but has no administration or omission recorded for that slot.`,
            metadata: { visitId: visit.id, scheduleId: schedule.id },
          });
        }
      }
    }
  },

  async detectLateAdministrations(organizationId: string, since: Date) {
    const events = await prisma.medicationEvent.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: MedicationEventStatus.ADMINISTERED,
        scheduleId: { not: null },
        administeredAt: { gte: since },
      },
      include: {
        schedule: true,
        visit: {
          select: {
            scheduledStart: true,
            clockInTime: true,
          },
        },
        medication: { select: { name: true } },
        client: { select: { id: true, name: true } },
      },
      take: 2000,
    });

    const graceMs = LATE_AFTER_SLOT_MINUTES * 60 * 1000;

    for (const ev of events) {
      if (!ev.schedule) continue;
      const anchor = ev.visit.clockInTime ?? ev.visit.scheduledStart ?? ev.administeredAt;
      const slot = combineDateWithTime(anchor, ev.schedule.timeOfDay);
      if (ev.administeredAt.getTime() <= slot.getTime() + graceMs) continue;

      await medicationAlertService.tryCreateAndNotify({
        organizationId,
        type: MedicationAlertType.LATE_MEDICATION,
        medicationId: ev.medicationId,
        clientId: ev.clientId,
        visitId: ev.visitId,
        scheduleId: ev.scheduleId,
        dedupeKey: `LATE:${ev.id}`,
        title: 'Late medication administration',
        detail: `${ev.medication.name} for ${ev.client.name} was recorded after the scheduled slot (scheduled ${slot.toISOString()}, recorded ${ev.administeredAt.toISOString()}).`,
        metadata: { medicationEventId: ev.id },
      });
    }
  },

  async detectPrnMisuse(organizationId: string) {
    const windowStart = new Date(Date.now() - PRN_WINDOW_HOURS * 60 * 60 * 1000);
    const events = await prisma.medicationEvent.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: MedicationEventStatus.ADMINISTERED,
        administeredAt: { gte: windowStart },
        medication: { isPrn: true, active: true },
      },
      select: {
        medicationId: true,
        clientId: true,
        administeredAt: true,
        medication: { select: { name: true } },
        client: { select: { name: true } },
      },
    });

    const counts = new Map<string, typeof events>();
    for (const e of events) {
      const key = `${e.medicationId}:${e.clientId}`;
      const arr = counts.get(key) ?? [];
      arr.push(e);
      counts.set(key, arr);
    }

    for (const [, group] of counts) {
      if (group.length < PRN_MAX_DOSES_IN_WINDOW) continue;
      const last = group.reduce((a, b) => (a.administeredAt > b.administeredAt ? a : b));
      const dayKey = last.administeredAt.toISOString().slice(0, 10);
      const head = group[0];
      await medicationAlertService.tryCreateAndNotify({
        organizationId,
        type: MedicationAlertType.PRN_MISUSE,
        medicationId: head.medicationId,
        clientId: head.clientId,
        dedupeKey: `PRN_MISUSE:${head.medicationId}:${head.clientId}:${dayKey}`,
        title: 'PRN medication frequency alert',
        detail: `${head.medication.name} for ${head.client.name}: ${group.length} administrations recorded in the last ${PRN_WINDOW_HOURS} hours (threshold ${PRN_MAX_DOSES_IN_WINDOW}).`,
        metadata: { count: group.length, windowHours: PRN_WINDOW_HOURS },
      });
    }
  },

  async detectLowStock(organizationId: string) {
    const rows = await prisma.medicationStock.findMany({
      where: {
        medication: { organizationId, active: true },
        currentStock: { not: null },
        reorderThreshold: { not: null },
      },
      include: {
        medication: {
          select: {
            id: true,
            name: true,
            clientId: true,
            client: { select: { name: true } },
          },
        },
      },
    });

    for (const row of rows) {
      if (row.currentStock === null || row.reorderThreshold === null) continue;
      if (row.currentStock > row.reorderThreshold) continue;
      await medicationAlertService.tryCreateAndNotify({
        organizationId,
        type: MedicationAlertType.LOW_STOCK,
        medicationId: row.medication.id,
        clientId: row.medication.clientId,
        dedupeKey: `LOW_STOCK:${row.medication.id}`,
        title: 'Low medication stock',
        detail: `${row.medication.name} for ${row.medication.client.name}: ${row.currentStock} remaining (reorder at ${row.reorderThreshold}).`,
        metadata: { currentStock: row.currentStock, reorderThreshold: row.reorderThreshold },
      });
    }
  },
};
