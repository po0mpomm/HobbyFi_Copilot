import { PrismaClient } from '@prisma/client'

// Global singleton for Prisma to prevent multiple instances during hot-reloading
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

/**
 * A safe query helper for Copilot that strictly excludes KYC fields at the ORM layer.
 * Any tool using this helper is physically unable to SELECT pan_number, bank_account, or gst_number.
 */
export const copilotVendorDb = {
  findUnique: async (args: Parameters<typeof prisma.vendors.findUnique>[0]) => {
    return prisma.vendors.findUnique({
      ...args,
      select: {
        vendor_id: true,
        business_name: true,
        track: true,
        category: true,
        contact_email: true,
        phone: true,
        onboarding_status: true,
        created_at: true,
      },
    });
  },
  findFirst: async (args: Parameters<typeof prisma.vendors.findFirst>[0]) => {
    return prisma.vendors.findFirst({
      ...args,
      select: {
        vendor_id: true,
        business_name: true,
        track: true,
        category: true,
        contact_email: true,
        phone: true,
        onboarding_status: true,
        created_at: true,
      },
    });
  },
  findMany: async (args: Parameters<typeof prisma.vendors.findMany>[0] = {}) => {
    return prisma.vendors.findMany({
      ...args,
      select: {
        vendor_id: true,
        business_name: true,
        track: true,
        category: true,
        contact_email: true,
        phone: true,
        onboarding_status: true,
        created_at: true,
      },
    });
  }
}
