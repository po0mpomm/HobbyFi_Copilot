import { NextResponse } from 'next/server';
import { prisma } from 'db';

export async function GET() {
  try {
    const vendors = await prisma.vendors.findMany({
      include: {
        staff_coaches: true,
      }
    });
    
    const result = vendors.map(v => ({
      id: v.vendor_id,
      name: v.business_name,
      track: v.track,
      staffId: v.staff_coaches.length > 0 ? v.staff_coaches[0].staff_id : null,
    }));
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
