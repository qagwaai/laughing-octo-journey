import { Component } from '@angular/core';
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
    >
      <app-scene-graph *canvasContent />
    </ngt-canvas>
  `,
  host: { class: 'block h-dvh w-full' },
  imports: [NgtCanvas, Experience, SceneGraph],
})
export class AppComponent {}
