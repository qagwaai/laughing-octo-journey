import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideNgtRenderer } from 'angular-three/dom';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import routes from './routed.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(), 
    provideRouter(routes, withComponentInputBinding()),
    provideNgtRenderer()
  ],
};
