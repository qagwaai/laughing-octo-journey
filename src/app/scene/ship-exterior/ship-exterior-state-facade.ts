import { coerceShipInventory, type ShipSummary } from '../../model/ship-list';
import type { ShipItem } from '../../model/ship-item';

export interface ShipExteriorStateFacadeDependencies {
  getNavigationShip(): ShipSummary | null;
  setNavigationShip(ship: ShipSummary): void;
  getSessionShip(): ShipSummary | null;
  setSessionShip(ship: ShipSummary): void;
  resolveLaunchableInventory(rawInventory: unknown): ShipItem[];
  resolveTargetingCapabilityFromInventory(inventory: readonly ShipItem[]): boolean;
  setLaunchableInventory(inventory: ShipItem[]): void;
  setHasExpendableDartDrone(hasDrone: boolean): void;
}

export interface ShipExteriorInventoryMutationResult {
  didMutateNavigationInventory: boolean;
  didMutateSessionInventory: boolean;
}

export class ShipExteriorStateFacade {
  constructor(private readonly dependencies: ShipExteriorStateFacadeDependencies) {}

  syncNavigationShipFromShipList(
    matchingShip: ShipSummary | null | undefined,
    normalizedInventory: readonly ShipItem[],
  ): void {
    if (!matchingShip) {
      return;
    }

    this.dependencies.setLaunchableInventory(this.dependencies.resolveLaunchableInventory(normalizedInventory));
    this.dependencies.setHasExpendableDartDrone(
      this.dependencies.resolveTargetingCapabilityFromInventory(normalizedInventory),
    );
    this.dependencies.setNavigationShip({
      ...matchingShip,
      inventory: [...normalizedInventory],
    });
  }

  removeConsumedLaunchItems(shipId: string, consumedItemIds: readonly string[]): ShipExteriorInventoryMutationResult {
    const deduplicatedConsumedItemIds = consumedItemIds
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .filter((value, index, values) => values.indexOf(value) === index);

    if (!shipId.trim() || deduplicatedConsumedItemIds.length === 0) {
      return {
        didMutateNavigationInventory: false,
        didMutateSessionInventory: false,
      };
    }

    let didMutateNavigationInventory = false;
    let didMutateSessionInventory = false;

    const navigationShip = this.dependencies.getNavigationShip();
    if (navigationShip && navigationShip.id === shipId) {
      const filteredInventory = coerceShipInventory(navigationShip.inventory).filter(
        (item) => !deduplicatedConsumedItemIds.includes(item.id),
      );
      didMutateNavigationInventory = filteredInventory.length !== coerceShipInventory(navigationShip.inventory).length;
      this.dependencies.setNavigationShip({
        ...navigationShip,
        inventory: filteredInventory,
      });
      this.dependencies.setLaunchableInventory(this.dependencies.resolveLaunchableInventory(filteredInventory));
      this.dependencies.setHasExpendableDartDrone(
        this.dependencies.resolveTargetingCapabilityFromInventory(filteredInventory),
      );
    }

    const sessionShip = this.dependencies.getSessionShip();
    if (sessionShip && sessionShip.id === shipId) {
      const filteredInventory = coerceShipInventory(sessionShip.inventory).filter(
        (item) => !deduplicatedConsumedItemIds.includes(item.id),
      );
      didMutateSessionInventory = filteredInventory.length !== coerceShipInventory(sessionShip.inventory).length;
      this.dependencies.setSessionShip({
        ...sessionShip,
        inventory: filteredInventory,
      });
    }

    return {
      didMutateNavigationInventory,
      didMutateSessionInventory,
    };
  }

  appendLaunchRewardItems(shipId: string, rewardItems: readonly ShipItem[]): ShipExteriorInventoryMutationResult {
    if (!shipId.trim() || rewardItems.length === 0) {
      return {
        didMutateNavigationInventory: false,
        didMutateSessionInventory: false,
      };
    }

    let didMutateNavigationInventory = false;
    let didMutateSessionInventory = false;

    const navigationShip = this.dependencies.getNavigationShip();
    if (navigationShip && navigationShip.id === shipId) {
      const updatedNavigationShip: ShipSummary = {
        ...navigationShip,
        inventory: [...coerceShipInventory(navigationShip.inventory), ...rewardItems],
      };
      this.dependencies.setNavigationShip(updatedNavigationShip);
      this.dependencies.setLaunchableInventory(
        this.dependencies.resolveLaunchableInventory(updatedNavigationShip.inventory),
      );
      this.dependencies.setHasExpendableDartDrone(
        this.dependencies.resolveTargetingCapabilityFromInventory(coerceShipInventory(updatedNavigationShip.inventory)),
      );
      didMutateNavigationInventory = true;
    }

    const sessionShip = this.dependencies.getSessionShip();
    if (sessionShip && sessionShip.id === shipId) {
      this.dependencies.setSessionShip({
        ...sessionShip,
        inventory: [...coerceShipInventory(sessionShip.inventory), ...rewardItems],
      });
      didMutateSessionInventory = true;
      return {
        didMutateNavigationInventory,
        didMutateSessionInventory,
      };
    }

    const refreshedNavigationShip = this.dependencies.getNavigationShip();
    if (refreshedNavigationShip && refreshedNavigationShip.id === shipId) {
      this.dependencies.setSessionShip(refreshedNavigationShip);
      didMutateSessionInventory = true;
    }

    return {
      didMutateNavigationInventory,
      didMutateSessionInventory,
    };
  }
}
