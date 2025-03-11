import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-container',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  template: `
    <div class="container">
      <header>
        <button (click)="navigateTo('sun')">Sun</button>
        <button (click)="navigateTo('rain')">Rain</button>
        <!-- <button (click)="navigateTo('sand')">Sand</button> -->
        <!-- <button (click)="navigateTo('motion')">Brownian</button> -->
      </header>
      <main>
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .container {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    header {
      margin: 20px 0;
    }
    main {
      width: 100%;
      display: flex;
      justify-content: center;
    }
    button {
      margin: 0 10px;
      padding: 10px 20px;
      font-size: 16px;
      cursor: pointer;
    }
  `],
})
export class ContainerComponent {
  value = false;
  constructor(private router: Router) {}

  navigateTo(path: string) {
    this.value = !this.value;
    this.router.navigate([path]);
  }
}
