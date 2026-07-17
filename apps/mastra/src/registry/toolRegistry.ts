/**
 * Track-aware Tool Registry
 * Returns the appropriate set of tools based on the vendor's active tracks.
 * Play-track vendors get court/booking tools, Pass-track vendors get membership tools.
 */
import { SessionContext } from '../types/session';

// Read tools
import { makeGetVendorStatusTool } from '../tools/read/getVendorStatusTool';
import { makeGetRevenueTool } from '../tools/read/getRevenueTool';
import { makeListBookingsTool } from '../tools/read/listBookingsTool';
import { makeGetOccupancyTool } from '../tools/read/getOccupancyTool';
import { makeGetPayoutSummaryTool } from '../tools/read/getPayoutSummaryTool';
import { makeGetMrrSnapshotTool } from '../tools/read/getMrrSnapshotTool';
import { makeListMembershipsTool } from '../tools/read/listMembershipsTool';
import { makeListTrialsTool } from '../tools/read/listTrialsTool';
import { makeGetCoachScheduleTool } from '../tools/read/getCoachScheduleTool';
import { makeFindUserTool } from '../tools/read/findUserTool';

// Write tools
import { makeExtendTrialTool } from '../tools/write/extendTrialTool';
import { makeProposeMembershipUpdateTool } from '../tools/write/proposeMembershipUpdateTool';
import { makeProposeNoShowTool } from '../tools/write/proposeNoShowTool';
import { makeProposeCancelBookingTool } from '../tools/write/proposeCancelBookingTool';

export function getToolsForSession(session: SessionContext) {
  let tools: Record<string, unknown> = {
    getVendorStatusTool: makeGetVendorStatusTool(session),
    getRevenueTool: makeGetRevenueTool(session),
    findUserTool: makeFindUserTool(session),
    getPayoutSummaryTool: makeGetPayoutSummaryTool(session),
    getCoachScheduleTool: makeGetCoachScheduleTool(session),
  };

  if (session.active_tracks.includes('play')) {
    tools = {
      ...tools,
      listBookingsTool: makeListBookingsTool(session),
      getOccupancyTool: makeGetOccupancyTool(session),
      proposeNoShowTool: makeProposeNoShowTool(session),
      proposeCancelBookingTool: makeProposeCancelBookingTool(session),
    };
  }

  if (session.active_tracks.includes('pass')) {
    tools = {
      ...tools,
      listMembershipsTool: makeListMembershipsTool(session),
      listTrialsTool: makeListTrialsTool(session),
      getMrrSnapshotTool: makeGetMrrSnapshotTool(session),
      extendTrialTool: makeExtendTrialTool(session),
      proposeMembershipUpdateTool: makeProposeMembershipUpdateTool(session),
    };
  }

  return tools;
}
