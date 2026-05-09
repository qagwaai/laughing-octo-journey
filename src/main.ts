import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { appLogger } from './app/services/logger';

bootstrapApplication(AppComponent, appConfig).catch((err) => appLogger.error(err));
