import { MissionProgressSyncService } from './mission-progress-sync.service';
import { MissionService } from './mission.service';
import type { ShipExteriorMissionGateState } from '../mission/ship-exterior-mission';

describe('MissionProgressSyncService', () => {
	const gateState: ShipExteriorMissionGateState = {
		missionId: 'first-target',
		characterId: 'char-1',
		activeObjectiveText: 'Mission objectives complete. Await further directives.',
		updatedAt: '2026-04-30T00:00:00.000Z',
		steps: [
			{ key: 'identify_iron_asteroid', status: 'completed', completedAt: '2026-04-30T00:00:00.000Z' },
			{ key: 'neutralize_identified_asteroid', status: 'completed', completedAt: '2026-04-30T00:00:00.000Z' },
			{ key: 'manufacture_hull_patch_kit', status: 'completed', completedAt: '2026-04-30T00:00:00.000Z' },
			{ key: 'repair_scavenger_pod', status: 'completed', completedAt: '2026-04-30T00:00:00.000Z' },
		],
	};

	const createGateStateWithStatuses = (
		statuses: Array<'locked' | 'active' | 'completed' | 'pending-retry'>,
	): ShipExteriorMissionGateState => ({
		missionId: 'first-target',
		characterId: 'char-1',
		activeObjectiveText: 'Objective',
		updatedAt: '2026-04-30T00:00:00.000Z',
		steps: [
			{ key: 'identify_iron_asteroid', status: statuses[0] ?? 'locked' },
			{ key: 'neutralize_identified_asteroid', status: statuses[1] ?? 'locked' },
			{ key: 'manufacture_hull_patch_kit', status: statuses[2] ?? 'locked' },
			{ key: 'repair_scavenger_pod', status: statuses[3] ?? 'locked' },
		],
	});

	it('should skip sync when required context is missing', async () => {
		const missionService = {
			upsertMissionStatus: jasmine.createSpy('upsertMissionStatus'),
		} as unknown as MissionService;
		const service = new MissionProgressSyncService(missionService);

		const result = await service.syncGateState({
			playerName: 'Pioneer',
			characterId: '',
			sessionKey: 'session-1',
			gateState,
		});

		expect(result).toBe('skipped');
		expect(missionService.upsertMissionStatus).not.toHaveBeenCalled();
	});

	it('should upsert mission status derived from gate state', async () => {
		const missionService = {
			upsertMissionStatus: jasmine.createSpy('upsertMissionStatus').and.returnValue(Promise.resolve('updated')),
		} as unknown as MissionService;
		const service = new MissionProgressSyncService(missionService);

		const result = await service.syncGateState({
			playerName: 'Pioneer',
			characterId: 'char-1',
			sessionKey: 'session-1',
			gateState,
		});

		expect(result).toBe('updated');
		expect(missionService.upsertMissionStatus).toHaveBeenCalledTimes(1);
		expect(missionService.upsertMissionStatus).toHaveBeenCalledWith(
			jasmine.objectContaining({
				playerName: 'Pioneer',
				characterId: 'char-1',
				sessionKey: 'session-1',
				missionId: 'first-target',
				status: 'completed',
			}),
		);
	});

	it('should derive started, in-progress, and completed mission statuses from gate states', async () => {
		const missionService = {
			upsertMissionStatus: jasmine.createSpy('upsertMissionStatus').and.returnValue(Promise.resolve('updated')),
		} as unknown as MissionService;
		const service = new MissionProgressSyncService(missionService);

		const matrix: Array<{
			label: string;
			statuses: Array<'locked' | 'active' | 'completed' | 'pending-retry'>;
			expectedStatus: string;
		}> = [
			{
				label: 'started when no step is completed',
				statuses: ['active', 'locked', 'locked', 'locked'],
				expectedStatus: 'started',
			},
			{
				label: 'in-progress when any step is completed',
				statuses: ['completed', 'active', 'locked', 'locked'],
				expectedStatus: 'in-progress',
			},
			{
				label: 'in-progress when a step is pending-retry',
				statuses: ['completed', 'pending-retry', 'locked', 'locked'],
				expectedStatus: 'in-progress',
			},
			{
				label: 'completed when all steps are completed',
				statuses: ['completed', 'completed', 'completed', 'completed'],
				expectedStatus: 'completed',
			},
		];

		for (const row of matrix) {
			await service.syncGateState({
				playerName: 'Pioneer',
				characterId: 'char-1',
				sessionKey: 'session-1',
				gateState: createGateStateWithStatuses(row.statuses),
			});
		}

		expect(missionService.upsertMissionStatus).toHaveBeenCalledTimes(matrix.length);
		const calls = (missionService.upsertMissionStatus as jasmine.Spy).calls.allArgs();
		for (let index = 0; index < matrix.length; index += 1) {
			expect(calls[index][0]).toEqual(
				jasmine.objectContaining({
					status: matrix[index].expectedStatus,
				}),
				`Unexpected status mapping for ${matrix[index].label}`,
			);
		}
	});
});
