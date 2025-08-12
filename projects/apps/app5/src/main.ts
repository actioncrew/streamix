import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { ImageProcessorComponent } from './app/image-processor.component';

bootstrapApplication(ImageProcessorComponent, appConfig)
  .catch((err) => console.error(err));
