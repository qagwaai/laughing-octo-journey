import { Component, signal } from '@angular/core';
import { NgtCanvas } from 'angular-three/dom';
import { Experience } from './experience/experience.component';
import { SceneGraph } from './scene-graph';
import { injectStore } from 'angular-three';

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
  `,
  host: { class: 'block h-dvh w-full' },
  styles: `:host { display: block; height: 100vh; width: 100vw; background: #050208; }`,
  imports: [NgtCanvas, Experience, SceneGraph],
})
export class AppComponent {
  onCanvasClick() {
    console.log("Canvas clicked");
  }
}
