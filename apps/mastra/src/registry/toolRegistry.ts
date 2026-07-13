/**
 * Track-aware Tool Registry
 * Returns the appropriate set of tools based on the vendor's active tracks.
 * Play-track vendors get court/booking tools, Pass-track vendors get membership tools.
 */
import { SessionContext } from '../types/session';

// Read tools
import { getVendorStatusTool } from '../tools/read/getVendorStatusTool';
import { getRevenueTool } from '../tools/read/getRevenueTool';
import { listBookingsTool } from '../tools/read/listBookingsTool';
import { getOccupancyTool } from '../tools/read/getOccupancyTool';
import { getPayoutSummaryTool } from '../tools/read/getPayoutSummaryTool';
import { getMrrSnapshotTool } from '../tools/read/getMrrSnapshotTool';
import { listMembershipsTool } from '../tools/read/listMembershipsTool';
import { listTrialsTool } from '../tools/read/listTrialsTool';
import { getCoachScheduleTool } from '../tools/read/getCoachScheduleTool';
import { findUserTool } from '../tools/read/findUserTool';

// Write tools
import { extendTrialTool } from '../tools/write/extendTrialTool';
import { proposeMembershipUpdateTool } from '../tools/write/proposeMembershipUpdateTool';
import { proposeNoShowTool } from '../tools/write/proposeNoShowTool';
import { proposeCancelBookingTool } from '../tools/write/proposeCancelBookingTool';

// Tools always available (cross-track)
const UNIVERSAL_TOOLS = {
  getVendorStatusTool,
  getRevenueTool,
  findUserTool,
  getPayoutSummaryTool,
  getCoachScheduleTool,
};

// Play-track specific tools
const PLAY_TOOLS = {
  listBookingsTool,
  getOccupancyTool,
  proposeNoShowTool,
  proposeCancelBookingTool,
};

// Pass-track specific tools
const PASS_TOOLS = {
  listMembershipsTool,
  listTrialsTool,
  getMrrSnapshotTool,
  extendTrialTool,
  proposeMembershipUpdateTool,
};

export function getToolsForSession(session: SessionContext) {
  let tools: Record<string, unknown> = { ...UNIVERSAL_TOOLS };

  if (session.active_tracks.includes('play')) {
    tools = { ...tools, ...PLAY_TOOLS };
  }

  if (session.active_tracks.includes('pass')) {
    tools = { ...tools, ...PASS_TOOLS };
  }

  return tools;
}
