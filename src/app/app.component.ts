import { Component, ElementRef, inject, signal } from '@angular/core';
import { TweakpaneButton, TweakpaneCheckbox, TweakpaneColor, TweakpanePane } from 'angular-three-tweakpane';
import { NgtCanvas } from 'angular-three/dom';
import { Experience } from './experience/experience.component';
import { SceneGraph } from './scene-graph';

// <app-experience *canvasContent />
@Component({
  selector: 'app-root',
  template: `
    <ngt-canvas
      shadows 
      [camera]="{ position: [5, 5, 5] }" 
      [lookAt]="[0, 1, 0]"
      (click)="onCanvasClick()"
    >
      <app-scene-graph *canvasContent />
    </ngt-canvas>
    <tweakpane-pane title="Billboard" [container]="host">
        <tweakpane-checkbox [(value)]="follow" label="Follow" />
        <tweakpane-checkbox [(value)]="lockX" label="Lock X" />
        <tweakpane-checkbox [(value)]="lockY" label="Lock Y" />
        <tweakpane-checkbox [(value)]="lockZ" label="Lock Z" />
        <tweakpane-color [(value)]="color" label="Color" />
        <tweakpane-button title="Reset" (click)="reset()" />
    </tweakpane-pane>
  `,
  host: { class: 'block h-dvh w-full' },
  styles: `:host { display: block; height: 100vh; width: 100vw; background: #050208; }`,
  imports: [NgtCanvas, Experience, SceneGraph, TweakpanePane, TweakpaneCheckbox, TweakpaneColor, TweakpaneButton],
})
export class AppComponent {
  protected host = inject(ElementRef);
  protected color = signal('#ff0000');
  protected follow = signal(true);
  protected lockX = signal(false);
  protected lockY = signal(false);
  protected lockZ = signal(false);
  reset() {
		console.log("Resetting billboard settings");
	}
  onCanvasClick() {
    console.log("Canvas clicked");
  }
}
