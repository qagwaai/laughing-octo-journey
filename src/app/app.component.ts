import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { injectStore, NgtCanvasElement } from 'angular-three';
import { NgtsStats } from 'angular-three-soba/stats';
import { TweakpaneButton, TweakpaneCheckbox, TweakpaneColor, TweakpanePane } from 'angular-three-tweakpane';
import { NgtCanvas } from 'angular-three/dom';
import { RoutedScene } from './routed-scene';

@Component({
  selector: 'app-root',
  template: `
    <ngt-canvas
      #canvas
      [stats]="{ parent: host, domClass: 'stats' }"
      shadows 
      [camera]="{ position: [5, 5, 5] }" 
      [lookAt]="[0, 0, 0]"
      (click)="onCanvasClick()"
    >
      <app-routed-scene *canvasContent />
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
    <ul class="absolute bottom-4 left-4 flex items-center gap-2">
    	<li>
				<a
					routerLink="intro"
					class="underline"
					routerLinkActive="text-blue-500"
					[routerLinkActiveOptions]="{ exact: true }"
				>
					intro
				</a>
			</li>

			<li>
				<a
					routerLink="knot"
					class="underline"
					routerLinkActive="text-blue-500"
					[routerLinkActiveOptions]="{ exact: true }"
				>
					knot
				</a>
			</li>
			<li>
				<a
					routerLink="scene-graph"
					class="underline"
					routerLinkActive="text-blue-500"
					[routerLinkActiveOptions]="{ exact: true }"
				>
					scene graph
				</a>
			</li>
		</ul>
  `,
  host: { class: 'block h-dvh w-full' },
  styles: `:host { display: block; height: 100vh; width: 100vw;
    & .stats {
				position: static !important;

				& canvas {
					margin-top: 0 !important;
				}
			}
  }`,
  schemas: [CUSTOM_ELEMENTS_SCHEMA], 
  imports: [NgtCanvas, RoutedScene, TweakpanePane, TweakpaneCheckbox, TweakpaneColor, TweakpaneButton, NgtsStats, RouterLink, RouterLinkActive],
})
export class AppComponent {
  protected host = inject(ElementRef);
  protected color = signal('#ff0000');
  protected stats = signal(true);
  protected follow = signal(true);
  protected lockX = signal(false);
  protected lockY = signal(false);
  protected lockZ = signal(false);

  constructor() { 
  }

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
