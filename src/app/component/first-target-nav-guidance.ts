import type { ShipExteriorMissionGateState } from '../mission/ship-exterior-mission';

export const FAB_LAB_HINT_DISMISS_PREFIX = 'first-target:fabrication-lab-hint-dismissed';
export const REPAIR_HINT_DISMISS_PREFIX = 'first-target:repair-retrofit-hint-dismissed';

export interface GuidedMissionCue {
  route: 'fabrication-lab' | 'repair-retrofit';
  stepKey: 'manufacture_hull_patch_kit' | 'repair_scavenger_pod';
  dismissPrefix: string;
}

export const GUIDED_MISSION_CUES: readonly GuidedMissionCue[] = [
  {
    route: 'repair-retrofit',
    stepKey: 'repair_scavenger_pod',
    dismissPrefix: REPAIR_HINT_DISMISS_PREFIX,
  },
  {
    route: 'fabrication-lab',
    stepKey: 'manufacture_hull_patch_kit',
    dismissPrefix: FAB_LAB_HINT_DISMISS_PREFIX,
  },
];

export function resolveActiveFirstTargetCue(state: ShipExteriorMissionGateState | null): GuidedMissionCue | null {
  if (!state?.steps) {
    return null;
  }

  return (
    GUIDED_MISSION_CUES.find((cue) => state.steps.some((step) => step.key === cue.stepKey && step.status === 'active')) ??
    null
  );
}

export function buildCueDismissalKey(
  cue: GuidedMissionCue,
  playerName: string,
  characterId: string,
): string | null {
  const normalizedPlayer = playerName.trim();
  const normalizedCharacter = characterId.trim();
  if (!normalizedPlayer || !normalizedCharacter) {
    return null;
  }

  return `${cue.dismissPrefix}::${normalizedPlayer}::${normalizedCharacter}`;
}
