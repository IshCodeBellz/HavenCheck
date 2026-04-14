import { prisma } from '../lib/prisma';

export const availabilityService = {
  async getAvailability(carerId: string, startDate?: string, endDate?: string) {
    const where: any = { carerId };

    if (startDate || endDate) {
      // Find availability periods that overlap with the requested date range
      where.OR = [
        // Period starts within range
        {
          startTime: {
            gte: startDate ? new Date(startDate) : undefined,
            lte: endDate ? new Date(endDate) : undefined,
          },
        },
        // Period ends within range
        {
          endTime: {
            gte: startDate ? new Date(startDate) : undefined,
            lte: endDate ? new Date(endDate) : undefined,
          },
        },
        // Period completely contains range
        {
          AND: [
            { startTime: { lte: endDate ? new Date(endDate) : undefined } },
            { endTime: { gte: startDate ? new Date(startDate) : undefined } },
          ],
        },
      ];

      // Clean up undefined values
      if (startDate && endDate) {
        where.OR = where.OR.map((condition: any) => {
          if (condition.AND) {
            return {
              AND: condition.AND.filter((c: any) => {
                const key = Object.keys(c)[0];
                const value = c[key];
                return value && (value.gte !== undefined || value.lte !== undefined);
              }),
            };
          }
          const key = Object.keys(condition)[0];
          const value = condition[key];
          if (value && (value.gte !== undefined || value.lte !== undefined)) {
            return condition;
          }
          return null;
        }).filter((c: any) => c !== null);
      } else if (startDate) {
        where.OR = [
          { startTime: { gte: new Date(startDate) } },
          { endTime: { gte: new Date(startDate) } },
        ];
      } else if (endDate) {
        where.OR = [
          { startTime: { lte: new Date(endDate) } },
          { endTime: { lte: new Date(endDate) } },
        ];
      }
    }

    return await prisma.availability.findMany({
      where,
      orderBy: { startTime: 'asc' },
    });
  },

  async createAvailability(carerId: string, data: { startTime: Date; endTime: Date; isAvailable: boolean }) {
    return await prisma.availability.create({
      data: {
        carerId,
        startTime: data.startTime,
        endTime: data.endTime,
        isAvailable: data.isAvailable,
      },
    });
  },

  async updateAvailability(id: string, carerId: string, data: { startTime?: Date; endTime?: Date; isAvailable?: boolean }, isAdmin: boolean = false) {
    // Verify ownership (unless admin)
    const existing = await prisma.availability.findUnique({
      where: { id },
    });

    if (!existing) {
      throw { status: 404, message: 'Availability not found' };
    }

    if (!isAdmin && existing.carerId !== carerId) {
      throw { status: 403, message: 'Not authorized to update this availability' };
    }

    const updateData: any = {};
    if (data.startTime !== undefined) updateData.startTime = data.startTime;
    if (data.endTime !== undefined) updateData.endTime = data.endTime;
    if (data.isAvailable !== undefined) updateData.isAvailable = data.isAvailable;

    return await prisma.availability.update({
      where: { id },
      data: updateData,
    });
  },

  async deleteAvailability(id: string, carerId: string, isAdmin: boolean = false) {
    // Verify ownership (unless admin)
    const existing = await prisma.availability.findUnique({
      where: { id },
    });

    if (!existing) {
      throw { status: 404, message: 'Availability not found' };
    }

    if (!isAdmin && existing.carerId !== carerId) {
      throw { status: 403, message: 'Not authorized to delete this availability' };
    }

    await prisma.availability.delete({
      where: { id },
    });
  },

  /**
   * Whether a shift can be booked: no overlapping "unavailable" block, and the whole window
   * must lie inside the union of "available" blocks the carer recorded.
   */
  async evaluateScheduleWindow(
    carerId: string,
    startTime: Date,
    endTime: Date
  ): Promise<{ ok: true } | { ok: false; message: string; code: string }> {
    if (
      !(startTime instanceof Date) ||
      !(endTime instanceof Date) ||
      Number.isNaN(startTime.getTime()) ||
      Number.isNaN(endTime.getTime())
    ) {
      return { ok: false, message: 'Invalid dates', code: 'INVALID_WINDOW' };
    }
    if (startTime >= endTime) {
      return { ok: false, message: 'Shift end must be after start', code: 'INVALID_WINDOW' };
    }

    const blocked = await prisma.availability.findFirst({
      where: {
        carerId,
        isAvailable: false,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });
    if (blocked) {
      return {
        ok: false,
        message: 'Carer is marked unavailable for part of this shift',
        code: 'UNAVAILABLE_BLOCK',
      };
    }

    const slots = await prisma.availability.findMany({
      where: {
        carerId,
        isAvailable: true,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
      orderBy: { startTime: 'asc' },
    });

    if (slots.length === 0) {
      return {
        ok: false,
        message:
          'Carer has no overlapping availability for this period. They must add an "available" block that fully covers the shift.',
        code: 'NO_AVAILABILITY',
      };
    }

    let cursor = startTime.getTime();
    const endMs = endTime.getTime();

    for (const slot of slots) {
      const slotStart = slot.startTime.getTime();
      const slotEnd = slot.endTime.getTime();
      if (slotEnd <= cursor) continue;
      if (slotStart > cursor) {
        return {
          ok: false,
          message: 'Carer availability does not fully cover this shift (gap in recorded availability)',
          code: 'AVAILABILITY_GAP',
        };
      }
      cursor = Math.max(cursor, slotEnd);
      if (cursor >= endMs) {
        return { ok: true };
      }
    }

    if (cursor < endMs) {
      return {
        ok: false,
        message: 'Carer availability does not extend to the end of this shift',
        code: 'AVAILABILITY_INCOMPLETE',
      };
    }

    return { ok: true };
  },

  async assertCanBookSchedule(carerId: string, startTime: Date, endTime: Date): Promise<void> {
    const r = await this.evaluateScheduleWindow(carerId, startTime, endTime);
    if (!r.ok) {
      const e: any = new Error(r.message);
      e.status = 400;
      e.code = r.code;
      throw e;
    }
  },

  /** @returns true when the shift can be booked (same rules as scheduling). */
  async checkAvailability(carerId: string, startTime: Date, endTime: Date): Promise<boolean> {
    const r = await this.evaluateScheduleWindow(carerId, startTime, endTime);
    return r.ok;
  },
};

