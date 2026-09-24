import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import type { MissionStatus } from '../../model/mission';
import type { ShipExteriorViewMissionContext } from '../../model/ship-exterior-view-context';

export interface NavigationStateIdentity {
  playerName: string;
  characterId: string;
  /**
   * Mission context supplied by the entry point that routed into the scene.
   * Absent when the scene is entered without an explicit mission (for example,
   * after dismissing an overlay), in which case callers should fall back to the
   * mission-agnostic exploration behavior.
   */
  missionContext: ShipExteriorViewMissionContext | null;
}

function readMissionContext(raw: unknown): ShipExteriorViewMissionContext | null {
  const candidate = (raw ?? {}) as {
    missionId?: unknown;
    celestialBodyId?: unknown;
    missionStatusHint?: unknown;
    seedPolicy?: unknown;
    shipDamagePreset?: unknown;
  };

  const missionId = typeof candidate.missionId === 'string' ? candidate.missionId.trim() : '';
  if (!missionId) {
    return null;
  }

  return {
    missionId,
    ...(typeof candidate.celestialBodyId === 'string' ? { celestialBodyId: candidate.celestialBodyId } : {}),
    ...(typeof candidate.missionStatusHint === 'string'
      ? { missionStatusHint: candidate.missionStatusHint as MissionStatus }
      : {}),
    ...(candidate.seedPolicy === 'auto' || candidate.seedPolicy === 'new' || candidate.seedPolicy === 'resume'
      ? { seedPolicy: candidate.seedPolicy }
      : {}),
    ...(typeof candidate.shipDamagePreset === 'string'
      ? { shipDamagePreset: candidate.shipDamagePreset as ShipExteriorViewMissionContext['shipDamagePreset'] }
      : {}),
  };
}

@Injectable({
  providedIn: 'root',
})
export class NavigationStateReader {
  resolve(router: Router): NavigationStateIdentity {
    const fallbackState = typeof window !== 'undefined' ? window.history.state : undefined;
    const navigationState = (router.getCurrentNavigation()?.extras.state ?? fallbackState) as
      | { playerName?: unknown; joinCharacter?: { id?: unknown }; missionContext?: unknown }
      | undefined;

    const playerName = typeof navigationState?.playerName === 'string' ? navigationState.playerName.trim() : '';
    const characterId =
      typeof navigationState?.joinCharacter?.id === 'string' ? navigationState.joinCharacter.id.trim() : '';

    return { playerName, characterId, missionContext: readMissionContext(navigationState?.missionContext) };
  }
}
