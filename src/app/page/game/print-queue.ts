import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { locale } from '../../i18n/locale';
import { SessionService, SocketService } from '../../services';
import { PrinterStateService } from '../../services/printer-state.service';
import { MissionProgressSyncService } from '../../services/mission-progress-sync.service';
import { ShipExteriorMissionStateService } from '../../services/ship-exterior-mission-state.service';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';
import type { PrintQueueItem } from '../../services/printer-state.service';
import {
	SHIP_LIST_REQUEST_EVENT,
	SHIP_LIST_RESPONSE_EVENT,
	coerceShipInventory,
	type ShipItem,
	type ShipListRequest,
	type ShipListResponse,
	type ShipSummary,
} from '../../model/ship-list';
import { PlayerCharacterSummary } from '../../model/character-list';
import {
	PRINTABLE_ITEMS,
	describePrintableMaterials,
	findConsumableMaterialsForPrintableItem,
	formatPrintableDuration,
	getMissingPrintableMaterials,
	hasPrintableItemInInventory,
	isPrintableItemQueued,
	type PrintableConsumedMaterial,
	type PrintableItemDefinition,
} from '../../model/printable-item';
import {
	evaluateMissionGateOnManufacture,
	parseMissionGateState,
	resolveShipExteriorMission,
	type ShipExteriorMissionGateState,
} from '../../mission/ship-exterior-mission';
import { type PrintQueueNavigationState } from './repair-retrofit-state';

@Component({
	selector: 'app-print-queue-page',
	templateUrl: './print-queue.html',
	styleUrls: ['./print-queue.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PrintQueuePage {
	protected readonly t = locale;
	private router = inject(Router);
	private socketService = inject(SocketService);
	private sessionService = inject(SessionService);
	private missionProgressSyncService = inject(MissionProgressSyncService);
	private missionStateService = inject(ShipExteriorMissionStateService);
	private printerService = inject(PrinterStateService);
	private destroyRef = inject(DestroyRef);
	private collectingItemIds = new Set<string>();
	private unsubscribeShipListResponse?: () => void;
	private navigationState: PrintQueueNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as PrintQueueNavigationState | undefined) ??
		(history.state as PrintQueueNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
	protected activeShip = signal<ShipSummary | null>(this.navigationState.joinShip ?? this.sessionService.activeShip() ?? null);

	protected printerQueue = this.printerService.queue;
	protected currentTime = signal(Date.now());
	protected printerError = signal<string | null>(null);
	protected printerSuccess = signal<string | null>(null);
	protected printableItems = signal<readonly PrintableItemDefinition[]>(PRINTABLE_ITEMS);

	protected printerStatus = computed(() => (this.printerQueue().length > 0 ? 'printing' : 'idle'));

	protected printerQueueWithStatus = computed(() => {
		const now = this.currentTime();
		return this.printerQueue().map((item) => ({
			...item,
			remainingMs: Math.max(0, item.durationMs - (now - new Date(item.startedAt).getTime())),
		}));
	});

	constructor() {
		this.socketService.connect(this.socketService.serverUrl);

		const playerName = this.playerName().trim();
		const characterId = this.joinCharacter()?.id?.trim() ?? '';
		if (playerName && characterId) {
			this.printerService.loadQueue(playerName, characterId);
		}

		if (this.socketService.getIsConnected()) {
			this.loadActiveShip();
		} else {
			this.socketService.once('connect', () => this.loadActiveShip());
		}

		const intervalId = setInterval(() => {
			this.currentTime.set(Date.now());
			this.checkPrintCompletion();
		}, 1000);
		this.destroyRef.onDestroy(() => {
			clearInterval(intervalId);
			this.unsubscribeShipListResponse?.();
		});

		this.checkPrintCompletion();
	}

	private loadActiveShip(): void {
		const playerName = this.playerName().trim();
		const characterId = this.joinCharacter()?.id?.trim() ?? '';
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

		if (!playerName || !characterId || !sessionKey) {
			return;
		}

		this.unsubscribeShipListResponse?.();
		this.unsubscribeShipListResponse = this.socketService.on(
			SHIP_LIST_RESPONSE_EVENT,
			(response: ShipListResponse) => {
				this.unsubscribeShipListResponse?.();

				if (!response.success) {
					return;
				}

				const nextShip = response.ships?.[0] ?? null;
				if (!nextShip) {
					return;
				}

				const hydratedShip: ShipSummary = {
					...nextShip,
					inventory: coerceShipInventory(nextShip.inventory),
				};

				this.activeShip.set(hydratedShip);
			},
		);

		const request: ShipListRequest = {
			playerName,
			characterId,
			sessionKey,
		};
		this.socketService.emit(SHIP_LIST_REQUEST_EVENT, request);
	}

	protected queuePrintableItem(printableItem: PrintableItemDefinition): void {
		const playerName = this.playerName().trim();
		const characterId = this.joinCharacter()?.id?.trim() ?? '';
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
		const ship = this.activeShip();
		const consumedMaterials = findConsumableMaterialsForPrintableItem(ship?.inventory, printableItem);
		if (!playerName || !characterId || !sessionKey || !ship?.id || !consumedMaterials) {
			this.printerError.set(this.getPrintableItemRequirementMessage(printableItem));
			return;
		}

		this.printerError.set(null);
		this.printerSuccess.set(null);

		this.consumePrintableMaterials(playerName, sessionKey, consumedMaterials, printableItem, 0, () => {
			this.activeShip.update((current) => {
				if (!current) {
					return current;
				}

				const consumedIds = new Set(consumedMaterials.map((item) => item.id));
				return {
					...current,
					inventory: (current.inventory ?? []).filter((item) => !consumedIds.has(item.id)),
				};
			});

			this.printerService.addToQueue(playerName, characterId, {
				itemType: printableItem.itemType,
				label: printableItem.displayName,
				durationMs: printableItem.durationMs,
				consumedMaterials,
			});
			this.printerSuccess.set(
				`${printableItem.displayName} queued for printing. ${this.describeConsumedMaterials(consumedMaterials)} consumed. Estimated time: ${formatPrintableDuration(printableItem.durationMs)}.`,
			);
		});
	}

	protected cancelPrintJob(item: PrintQueueItem): void {
		const playerName = this.playerName().trim();
		const characterId = this.joinCharacter()?.id?.trim() ?? '';
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
		const shipId = this.activeShip()?.id?.trim() ?? '';
		if (!playerName || !characterId || !sessionKey || !shipId) {
			return;
		}

		const consumedMaterials = item.consumedMaterials ?? [];
		if (consumedMaterials.length === 0) {
			this.printerService.removeFromQueue(playerName, characterId, item.id);
			this.collectingItemIds.delete(item.id);
			return;
		}

		this.restorePrintableMaterials(playerName, sessionKey, shipId, characterId, consumedMaterials, 0, [], (restoredItems) => {
			this.activeShip.update((current) => {
				if (!current) {
					return current;
				}

				return {
					...current,
					inventory: [...(current.inventory ?? []), ...restoredItems],
				};
			});

			this.printerService.removeFromQueue(playerName, characterId, item.id);
			this.collectingItemIds.delete(item.id);
			this.printerSuccess.set(`Print job canceled. ${this.describeConsumedMaterials(consumedMaterials)} returned to ship inventory.`);
		});
	}

	protected formatRemainingTime(ms: number): string {
		if (ms <= 0) {
			return '0:00';
		}

		const totalSeconds = Math.floor(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}

	protected hasPrintableItem(printableItem: PrintableItemDefinition): boolean {
		return hasPrintableItemInInventory(this.activeShip()?.inventory, printableItem);
	}

	protected isPrintableItemPrinting(printableItem: PrintableItemDefinition): boolean {
		return isPrintableItemQueued(this.printerQueue(), printableItem);
	}

	protected canQueuePrintableItem(printableItem: PrintableItemDefinition): boolean {
		return !this.hasPrintableItem(printableItem)
			&& !this.isPrintableItemPrinting(printableItem)
			&& !!findConsumableMaterialsForPrintableItem(this.activeShip()?.inventory, printableItem)
			&& !!this.activeShip();
	}

	protected getPrintableItemDurationLabel(printableItem: PrintableItemDefinition): string {
		return formatPrintableDuration(printableItem.durationMs);
	}

	protected getPrintableItemMaterialLabels(printableItem: PrintableItemDefinition): string[] {
		return describePrintableMaterials(printableItem);
	}

	protected getPrintableItemRequirementMessage(printableItem: PrintableItemDefinition): string {
		const missingMaterials = getMissingPrintableMaterials(printableItem, this.activeShip()?.inventory);
		if (missingMaterials.length === 0) {
			return `${printableItem.displayName} is not available to print right now.`;
		}

		return `${missingMaterials.join(', ')} required in ship inventory to start this print job.`;
	}

	private checkPrintCompletion(): void {
		const now = Date.now();
		for (const item of this.printerQueue()) {
			if (this.collectingItemIds.has(item.id)) {
				continue;
			}

			const elapsed = now - new Date(item.startedAt).getTime();
			if (elapsed >= item.durationMs) {
				this.collectingItemIds.add(item.id);
				this.collectCompletedPrintJob(item);
			}
		}
	}

	private collectCompletedPrintJob(item: PrintQueueItem): void {
		const playerName = this.playerName().trim();
		const characterId = this.joinCharacter()?.id?.trim() ?? '';
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
		const shipId = this.activeShip()?.id?.trim() ?? '';

		if (!playerName || !characterId || !sessionKey || !shipId) {
			this.collectingItemIds.delete(item.id);
			return;
		}

		this.socketService.upsertItem(
			{
				playerName,
				sessionKey,
				item: {
					itemType: item.itemType,
					displayName: item.label,
					launchable: false,
					state: 'contained',
					damageStatus: 'intact',
					container: { containerType: 'ship', containerId: shipId },
					owningPlayerId: playerName,
					owningCharacterId: characterId,
				},
			},
			(response) => {
				this.collectingItemIds.delete(item.id);
				if (!response.success || !response.item) {
					this.printerError.set(response.message || 'Failed to collect completed print job.');
					return;
				}

				this.activeShip.update((current) => {
					if (!current) {
						return current;
					}

					return {
						...current,
						inventory: [...(current.inventory ?? []), response.item!],
					};
				});

				this.printerService.removeFromQueue(playerName, characterId, item.id);
				this.advanceMissionGateOnManufacture(characterId, item.itemType);
				this.printerSuccess.set(`${item.label} print complete and added to ship inventory.`);
			},
		);
	}

	private advanceMissionGateOnManufacture(characterId: string, manufacturedItemType: string): void {
		const missionId = FIRST_TARGET_MISSION_ID;
		const playerName = this.playerName().trim();
		if (!playerName || !characterId) {
			return;
		}

		const mission = resolveShipExteriorMission(missionId);
		const context = { missionId, playerName, characterId };
		const stored = this.missionStateService.loadState(context);
		const steps = mission.getGateStepDefinitions();
		const normalizedStored = stored
			? parseMissionGateState({
				rawStatusDetail: JSON.stringify(stored),
				missionId,
				characterId,
				steps,
			})
			: null;
		const gateState = normalizedStored ?? stored;
		if (!gateState) {
			return;
		}

		const evaluation = evaluateMissionGateOnManufacture({ mission, gateState, manufacturedItemType });
		if (evaluation.changed) {
			this.missionStateService.saveState(context, evaluation.gateState);
			void this.syncMissionProgressToBackend(evaluation.gateState);
		}
	}

	private async syncMissionProgressToBackend(gateState: ShipExteriorMissionGateState): Promise<void> {
		await this.missionProgressSyncService.syncGateState({
			playerName: this.playerName(),
			characterId: this.joinCharacter()?.id ?? '',
			sessionKey: this.sessionService.getSessionKey() ?? '',
			gateState,
		});
	}

	private describeConsumedMaterials(consumedMaterials: readonly PrintableConsumedMaterial[]): string {
		if (consumedMaterials.length === 0) {
			return 'Materials';
		}

		const counts = new Map<string, number>();
		for (const material of consumedMaterials) {
			counts.set(material.label, (counts.get(material.label) ?? 0) + 1);
		}

		return Array.from(counts.entries())
			.map(([label, count]) => `${count} ${label}`)
			.join(', ');
	}

	private consumePrintableMaterials(
		playerName: string,
		sessionKey: string,
		consumedMaterials: readonly PrintableConsumedMaterial[],
		printableItem: PrintableItemDefinition,
		index: number,
		onComplete: () => void,
	): void {
		const nextMaterial = consumedMaterials[index];
		if (!nextMaterial) {
			onComplete();
			return;
		}

		this.socketService.upsertItem(
			{
				playerName,
				sessionKey,
				item: {
					id: nextMaterial.id,
					state: 'destroyed',
					damageStatus: 'destroyed',
					container: null,
					destroyedAt: new Date().toISOString(),
					destroyedReason: `Consumed by 3D printer job: ${printableItem.itemType}`,
				},
			},
			(response) => {
				if (!response.success) {
					this.printerError.set(response.message || `Unable to consume ${nextMaterial.label} for print job.`);
					return;
				}

				this.consumePrintableMaterials(playerName, sessionKey, consumedMaterials, printableItem, index + 1, onComplete);
			},
		);
	}

	private restorePrintableMaterials(
		playerName: string,
		sessionKey: string,
		shipId: string,
		characterId: string,
		consumedMaterials: readonly PrintableConsumedMaterial[],
		index: number,
		restoredItems: ShipItem[],
		onComplete: (items: ShipItem[]) => void,
	): void {
		const nextMaterial = consumedMaterials[index];
		if (!nextMaterial) {
			onComplete(restoredItems);
			return;
		}

		this.socketService.upsertItem(
			{
				playerName,
				sessionKey,
				item: {
					id: nextMaterial.id,
					itemType: nextMaterial.itemType,
					displayName: nextMaterial.label,
					launchable: false,
					state: 'contained',
					damageStatus: 'intact',
					container: { containerType: 'ship', containerId: shipId },
					owningPlayerId: playerName,
					owningCharacterId: characterId,
					destroyedAt: null,
					destroyedReason: null,
				},
			},
			(response) => {
				if (!response.success || !response.item) {
					this.printerError.set(response.message || `Unable to restore ${nextMaterial.label} from canceled print job.`);
					return;
				}

				this.restorePrintableMaterials(
					playerName,
					sessionKey,
					shipId,
					characterId,
					consumedMaterials,
					index + 1,
					[...restoredItems, response.item],
					onComplete,
				);
			},
		);
	}
}
