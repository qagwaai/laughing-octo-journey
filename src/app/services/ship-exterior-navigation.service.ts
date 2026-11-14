import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import type { PlayerCharacterSummary } from '../model/character-list';
import { FIRST_TARGET_MISSION_ID } from '../model/mission.locale';
import type { ShipSummary } from '../model/ship-list';
import { isValidShipSpatial } from '../model/spatial';
import { MissionNavigationService } from './mission-navigation';
import { MissionService } from './mission.service';
import { SessionService } from './session.service';

@Injectable({ providedIn: 'root' })
export class ShipExteriorNavigationService {
  private readonly router = inject(Router);
  private readonly sessionService = inject(SessionService);
  private readonly missionService = inject(MissionService);
  private readonly missionNavigationService = inject(MissionNavigationService);

  async navigate(ship: ShipSummary, playerName: string, joinCharacter: PlayerCharacterSummary | null): Promise<void> {
    const activeShip = this.sessionService.activeShip();
    const activeShipId = typeof activeShip?.id === 'string' ? activeShip.id.trim().toLowerCase() : '';
    const selectedShipId = typeof ship.id === 'string' ? ship.id.trim().toLowerCase() : '';
    const sameShip = !!activeShipId && activeShipId === selectedShipId;
    const navigationShip = sameShip && activeShip && isValidShipSpatial(activeShip.spatial)
      ? { ...ship, spatial: activeShip.spatial }
      : ship;
    this.sessionService.setActiveShip(navigationShip);

    const missions = joinCharacter?.missions;
    const firstTargetMissionStatus = Array.isArray(missions)
      ? missions.find((mission) => mission.missionId === FIRST_TARGET_MISSION_ID)?.status
      : undefined;
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

    let missionContext;
    if (joinCharacter && playerName) {
      const prepared = await this.missionNavigationService.prepareNavigation({
        missionId: FIRST_TARGET_MISSION_ID,
        playerName,
        joinCharacter,
        sessionKey,
        missionStatus: firstTargetMissionStatus ?? null,
      });
      missionContext = prepared.missionContext;
    } else {
      missionContext = {
        missionId: FIRST_TARGET_MISSION_ID,
        seedPolicy: 'resume' as const,
        ...(firstTargetMissionStatus ? { missionStatusHint: firstTargetMissionStatus } : {}),
      };
    }

    if (this.missionService.isMissionInProgress(firstTargetMissionStatus)) {
      const damagePreset = this.missionService.getMissionDamagePreset(
        FIRST_TARGET_MISSION_ID,
        firstTargetMissionStatus ?? null,
      );
      if (damagePreset) {
        missionContext = { ...missionContext, shipDamagePreset: damagePreset };
      }
    }

    await this.router.navigate([{ outlets: { primary: ['ship-exterior-view'], right: null, left: ['ship-hangar'] } }], {
      preserveFragment: true,
      state: {
        playerName,
        joinCharacter,
        joinShip: navigationShip,
        missionContext,
        ...(firstTargetMissionStatus ? { firstTargetMissionStatus } : {}),
      },
    });
  }
}
