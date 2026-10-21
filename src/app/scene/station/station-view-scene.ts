import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, input, output } from '@angular/core';
import { NgtArgs } from 'angular-three';
import { NgtsOrbitControls } from 'angular-three-soba/controls';
import type { RenderQuality } from '../render-quality';
import { StationModel, type StationModelStatus } from './station-model';

@Component({
  selector: 'app-station-view-scene',
  template: `
    <ngt-color *args="['#040914']" attach="background" />
    <ngt-hemisphere-light *args="['#9cbbe7', '#211208', 2.5]" />
    <ngt-directional-light [position]="[3, 4, 4]" [intensity]="4" color="#e0edff" />
    <ngt-directional-light [position]="[-3, 1, 2]" [intensity]="2" color="#ffb16a" />
    <ngt-directional-light [position]="[1, 2, -3]" [intensity]="4" color="#5c9dff" />
    <ngts-orbit-controls [options]="{ enablePan: false, enableDamping: false, minDistance: 2.2, maxDistance: 12 }" />
    <app-station-model
      [bodyId]="bodyId()"
      [quality]="quality()"
      [radius]="1.6"
      [attempt]="attempt()"
      (statusChange)="statusChange.emit($event)"
    />
  `,
  imports: [NgtArgs, NgtsOrbitControls, StationModel],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StationViewScene {
  readonly bodyId = input.required<string>();
  readonly quality = input.required<RenderQuality>();
  readonly attempt = input(0);
  readonly statusChange = output<StationModelStatus>();
}
