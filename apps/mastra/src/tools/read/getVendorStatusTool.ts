import { createTool } from '@mastra/core';
import { z } from 'zod';
import { copilotVendorDb } from 'db';

export const getVendorStatusTool = createTool({
  id: 'Get Vendor Status',
  description: 'Gets the current onboarding and verification status of a vendor.',
  inputSchema: z.object({
    vendor_id: z.string().describe('The UUID of the vendor'),
  }),
  execute: async ({ context }) => {
    const { vendor_id } = context;
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
