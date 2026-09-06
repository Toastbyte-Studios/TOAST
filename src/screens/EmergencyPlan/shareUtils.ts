import { Share } from 'react-native';
import { RallyPoint, CommunicationPlan } from '../../stores';

// Wire-format identifiers, not display copy. These values are written into
// shared payloads and validated on import (see parseShared* below), so
// renaming them would cause any payload produced by an older build to be
// rejected. Deliberately left on the legacy prefix during the rebrand; change
// them only alongside a VERSION bump and a migration path.
const RALLY_POINTS_TYPE = 'toast-rally-points';
const COMM_PLAN_TYPE = 'toast-comm-plan';
const VERSION = 1;

interface RallyPointsPayload {
  type: typeof RALLY_POINTS_TYPE;
  version: number;
  data: Array<{ name: string; description: string; coordinates?: string }>;
}

interface CommPlanPayload {
  type: typeof COMM_PLAN_TYPE;
  version: number;
  data: {
    whoCallsWhom: string;
    ifPhonesDown: string;
    outOfAreaContact: string;
    checkInSchedule: string;
  };
}

/**
 * Serializes the given rally points and opens the native share sheet.
 * Recipients can paste the shared text into the app's import dialog.
 */
export async function shareRallyPoints(
  rallyPoints: RallyPoint[],
): Promise<void> {
  const payload: RallyPointsPayload = {
    type: RALLY_POINTS_TYPE,
    version: VERSION,
    data: rallyPoints.map(({ name, description, coordinates }) => ({
      name,
      description,
      ...(coordinates ? { coordinates } : {}),
    })),
  };
  const text = JSON.stringify(payload);
  await Share.share({ message: text, title: 'ColdBoot Rally Points' });
}

/**
 * Serializes the communication plan and opens the native share sheet.
 * Recipients can paste the shared text into the app's import dialog.
 */
export async function shareCommunicationPlan(
  plan: CommunicationPlan,
): Promise<void> {
  const payload: CommPlanPayload = {
    type: COMM_PLAN_TYPE,
    version: VERSION,
    data: {
      whoCallsWhom: plan.whoCallsWhom,
      ifPhonesDown: plan.ifPhonesDown,
      outOfAreaContact: plan.outOfAreaContact,
      checkInSchedule: plan.checkInSchedule,
    },
  };
  const text = JSON.stringify(payload);
  await Share.share({ message: text, title: 'ColdBoot Communication Plan' });
}

/** Maximum allowed character length for any string field in a shared payload. */
const MAX_FIELD_LENGTH = 1000;

/**
 * Parses a shared rally-points JSON string.
 * Returns the array of rally point stubs on success, or `null` if the
 * payload is malformed or has an unexpected type/version.
 */
export function parseSharedRallyPoints(
  raw: string,
): RallyPointsPayload['data'] | null {
  try {
    const parsed = JSON.parse(raw.trim()) as RallyPointsPayload;
    if (parsed.type !== RALLY_POINTS_TYPE || parsed.version !== VERSION) {
      return null;
    }
    if (!Array.isArray(parsed.data)) {
      return null;
    }
    // Basic shape and length validation
    const valid = parsed.data.every(
      (item) =>
        typeof item.name === 'string' &&
        item.name.length <= MAX_FIELD_LENGTH &&
        typeof item.description === 'string' &&
        item.description.length <= MAX_FIELD_LENGTH &&
        (item.coordinates === undefined ||
          (typeof item.coordinates === 'string' &&
            item.coordinates.length <= MAX_FIELD_LENGTH)),
    );
    return valid ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Parses a shared communication-plan JSON string.
 * Returns the plan data on success, or `null` if the payload is malformed.
 */
export function parseSharedCommunicationPlan(
  raw: string,
): CommPlanPayload['data'] | null {
  try {
    const parsed = JSON.parse(raw.trim()) as CommPlanPayload;
    if (parsed.type !== COMM_PLAN_TYPE || parsed.version !== VERSION) {
      return null;
    }
    const d = parsed.data;
    if (
      typeof d.whoCallsWhom !== 'string' ||
      d.whoCallsWhom.length > MAX_FIELD_LENGTH ||
      typeof d.ifPhonesDown !== 'string' ||
      d.ifPhonesDown.length > MAX_FIELD_LENGTH ||
      typeof d.outOfAreaContact !== 'string' ||
      d.outOfAreaContact.length > MAX_FIELD_LENGTH ||
      typeof d.checkInSchedule !== 'string' ||
      d.checkInSchedule.length > MAX_FIELD_LENGTH
    ) {
      return null;
    }
    return d;
  } catch {
    return null;
  }
}
