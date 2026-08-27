import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

export interface NavigationStateIdentity {
  playerName: string;
  characterId: string;
}

@Injectable({
  providedIn: 'root',
})
export class NavigationStateReader {
  resolve(router: Router): NavigationStateIdentity {
    const fallbackState = typeof window !== 'undefined' ? window.history.state : undefined;
    const navigationState = (router.getCurrentNavigation()?.extras.state ?? fallbackState) as
      | { playerName?: unknown; joinCharacter?: { id?: unknown } }
      | undefined;

    const playerName = typeof navigationState?.playerName === 'string' ? navigationState.playerName.trim() : '';
    const characterId =
      typeof navigationState?.joinCharacter?.id === 'string' ? navigationState.joinCharacter.id.trim() : '';

    return { playerName, characterId };
  }
}
