import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  createShipExteriorBareSceneTestApi,
  registerShipExteriorBareSceneTestApi,
  unregisterShipExteriorBareSceneTestApi,
  type ShipExteriorBareSceneTestApiFactoryDeps,
} from './ship-exterior-bare-scene-test-api';

@Injectable({ providedIn: 'root' })
export class ShipExteriorBareSceneTestAdapter {
  register(deps: ShipExteriorBareSceneTestApiFactoryDeps): void {
    unregisterShipExteriorBareSceneTestApi();
    registerShipExteriorBareSceneTestApi(
      createShipExteriorBareSceneTestApi(deps),
      environment.e2eTestApiEnabled && !environment.production,
    );
  }

  unregister(): void {
    unregisterShipExteriorBareSceneTestApi();
  }
}
