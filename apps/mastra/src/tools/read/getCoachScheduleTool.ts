import type { SessionContext } from '../../types/session';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { prisma } from 'db';

export const makeGetCoachScheduleTool = (session: SessionContext) => createTool({
  id: 'get_coach_schedule',
  description: 'Get coach/staff schedule and assigned classes for the vendor.',
  inputSchema: z.object({
    venue_id: z.string().optional(),
    role: z.enum(['coach', 'front_desk', 'manager']).optional(),
  }),
  execute: async (context) => {
    const { vendor_id, staff_user_id } = session;
    const { venue_id, role } = context;

    if (venue_id) {
      const venue = await prisma.venues.findFirst({ where: { venue_id, vendor_id } });
      if (!venue) return { error: 'Venue not found or does not belong to this vendor' };
    }

    const where: Record<string, unknown> = { vendor_id };
    if (venue_id) where.venue_id = venue_id;
    if (role) where.role = role;

    const staff = await prisma.staff_coaches.findMany({
      where,
      select: {
        staff_id: true,
        name: true,
        role: true,
        commission_rate: true,
        assigned_classes: true,
        venue: { select: { name: true } },
      },
    });

    return { staff, total: staff.length };
  },
});
