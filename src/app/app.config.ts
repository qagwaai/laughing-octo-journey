import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideNgtRenderer } from 'angular-three/dom';

export const appConfig: ApplicationConfig = {
  providers: [provideZonelessChangeDetection(), provideNgtRenderer()],
};
