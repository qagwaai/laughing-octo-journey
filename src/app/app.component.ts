import { Component } from '@angular/core';
import { NgtCanvas } from 'angular-three/dom';
import { Experience } from './experience/experience.component';

@Component({
  selector: 'app-root',
  template: `
    <ngt-canvas>
      <app-experience *canvasContent />
    </ngt-canvas>
  `,
  host: { class: 'block h-dvh w-full' },
  imports: [NgtCanvas, Experience],
})
export class AppComponent {}
