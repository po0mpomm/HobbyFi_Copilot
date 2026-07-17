import type { SessionContext } from '../../types/session';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { copilotVendorDb } from 'db';

export const makeGetVendorStatusTool = (session: SessionContext) => createTool({
  id: 'Get Vendor Status',
  description: 'Gets the current onboarding and verification status of a vendor.',
  inputSchema: z.object({
      }),
  execute: async (context) => {
    const { vendor_id, staff_user_id } = session;
    
    try {
      const vendor = await copilotVendorDb.findUnique({
        where: { vendor_id },
      });
      if (!vendor) {
        return { error: 'Vendor not found' };
      }
      return {
        vendor_id: vendor.vendor_id,
        business_name: vendor.business_name,
        onboarding_status: vendor.onboarding_status,
        track: vendor.track,
      };
    } catch (e) {
      return { error: 'Database error' };
    }
  },
});
