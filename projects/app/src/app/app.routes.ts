import { Routes } from '@angular/router';
import { AppSunComponent } from './sun.component';
import { AppRainComponent } from './rain.component';
import { AppSandComponent } from './sand.component';
import { AppMotionComponent } from './brownian.component';

export const routes: Routes = [
  { path: 'sun', component: AppSunComponent },
  { path: 'rain', component: AppRainComponent },
  { path: 'sand', component: AppSandComponent },
  { path: 'motion', component: AppMotionComponent },
  { path: '', redirectTo: 'sun', pathMatch: 'full' },
];
