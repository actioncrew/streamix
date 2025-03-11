import { bootstrapApplication } from '@angular/platform-browser';

import { appConfig } from './app/app.config';
import { ContainerComponent } from './app/app.container';

bootstrapApplication(ContainerComponent, appConfig)
  .catch((err) => console.warn(err));
