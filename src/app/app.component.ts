import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, inject, signal, viewChild } from '@angular/core';
import { NgtCanvasElement } from 'angular-three';
import { NgtsStats } from 'angular-three-soba/stats';
import { TweakpaneButton, TweakpaneCheckbox, TweakpaneColor, TweakpanePane } from 'angular-three-tweakpane';
import { NgtCanvas } from 'angular-three/dom';
import { Experience } from './experience/experience.component';
import { SceneGraph } from './scene/scene-graph';

@Component({
  selector: 'app-root',
  template: `
    <ngt-canvas
      #canvas
      [stats]="{ parent: host, domClass: 'stats' }"
      shadows 
      [camera]="{ position: [5, 5, 5] }" 
      [lookAt]="[0, 1, 0]"
      (click)="onCanvasClick()"
    >
      <ng-template canvasContent>
        <app-scene-graph />
      </ng-template>
    </ngt-canvas>
    <tweakpane-pane title="Options" [container]="host">
        <tweakpane-checkbox [(value)]="stats" label="Show Stats" (valueChange)="onStatsChange($event)" />
        <tweakpane-checkbox [(value)]="follow" label="Follow" />
        <tweakpane-checkbox [(value)]="lockX" label="Lock X" />
        <tweakpane-checkbox [(value)]="lockY" label="Lock Y" />
        <tweakpane-checkbox [(value)]="lockZ" label="Lock Z" />
        <tweakpane-color [(value)]="color" label="Color" />
        <tweakpane-button title="Reset" (click)="reset()" />
    </tweakpane-pane>
  `,
  host: { class: 'block h-dvh w-full' },
  styles: `:host { display: block; height: 100vh; width: 100vw; background: #050208;
    & .stats {
				position: static !important;

				& canvas {
					margin-top: 0 !important;
				}
			}
  }`,
  schemas: [CUSTOM_ELEMENTS_SCHEMA], 
  imports: [NgtCanvas, Experience, SceneGraph, TweakpanePane, TweakpaneCheckbox, TweakpaneColor, TweakpaneButton, NgtsStats],
})
export class AppComponent {
  protected host = inject(ElementRef);
  protected color = signal('#ff0000');
  protected stats = signal(true);
  protected follow = signal(true);
  protected lockX = signal(false);
  protected lockY = signal(false);
  protected lockZ = signal(false);
  private canvasRef = viewChild<ElementRef<NgtCanvasElement>>('canvas');
  reset() {
		console.log("Resetting billboard settings");
	}

  onCanvasClick() {}

  onStatsChange(value: boolean) {
    var statsElement = this.host.nativeElement.querySelector('.stats');
    if (statsElement) {
      statsElement.style.display = value ? 'block' : 'none';
    }
  }
}
