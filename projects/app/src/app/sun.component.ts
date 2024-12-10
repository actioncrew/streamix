import {
  createSubject,
  fromEvent,
  interval,
  map,
  startWith,
  Subscribable,
  switchMap,
  tap,
  timer,
  takeUntil,
  withLatestFrom,
} from '@actioncrew/streamix';
import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-caption',
  template: `
    <div class="caption">
      {{ displayedCaption }}
      <span *ngIf="showCursor" class="cursor">_</span>
    </div>
  `,
  host: { 'data-component-id': 'sun' },
  styles: `
    .caption {
      font-family: monospace;
      font-size: 48px;
      color: #0f0;
      text-align: center;
      position: relative;
      background: transparent;
    }

    .cursor {
      position: absolute;
      right: 0;
      top: 0;
      transform: translateX(100%);
      animation: blink 0.5s step-start infinite;
    }

    @keyframes blink {
      0% { opacity: 0; }
      33% { opacity: 1; }
      100% { opacity: 1; }
    }
  `,
  standalone: true,
  imports: [CommonModule]
})
export class CaptionComponent implements OnInit {
  caption: string = 'Streamix';
  displayedCaption: string = '';
  showCursor: boolean = true;

  ngOnInit() {
    this.startTypingEffect();
    this.startCursorBlinking();
  }

  startTypingEffect() {
    let currentIndex = 0;
    const typeInterval = 200;

    timer(1800, typeInterval).subscribe(() => {
      if (currentIndex < this.caption.length) {
        this.displayedCaption += this.caption[currentIndex];
        currentIndex++;
      }
    });
  }

  startCursorBlinking() {
    interval(500).subscribe(() => {
      this.showCursor = !this.showCursor;
    });
  }
}

@Component({
  selector: 'app-sun',
  standalone: true,
  imports: [RouterOutlet, CaptionComponent],
  template: `
  <div class="container">
    <app-caption></app-caption>
    <canvas></canvas>
  </div>`,
  styleUrls: ['./app.component.scss']
})
export class AppSunComponent implements AfterViewInit, OnDestroy {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private fontSize = 12;
  private letterArray = '0123456789'.split('');
  private colorPalette = ['#0f0', '#f0f', '#0ff', '#f00', '#ff0'];
  private destroy$ = createSubject<void>();
  private scene$!: Subscribable;

  ngAfterViewInit() {
    this.canvas = document.querySelector('canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.setupAnimation();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupAnimation() {
    const resize$ = fromEvent(window, 'resize').pipe(
      startWith(this.getCanvasSize()),
      map(() => this.getCanvasSize())
    );

    const rays$ = resize$.pipe(
      map(({ width, height }) => ({
        width,
        height,
        rays: Array.from({ length: 30 }, (_, i) => ({ // Create 30 rays
          angle: (i / 30) * Math.PI / 2, // Spread over quarter circle
          position: 10,
        })),
        sun: {
          x: 0,  // Position of the sun's center in the top-left corner
          y: 0,  // Position of the sun's center in the top-left corner
          radius: 120,  // Radius of the sun
        }
      }))
    );

    let value = 0;
    const draw$ = interval(33).pipe(
      withLatestFrom(rays$),
      tap(([_, { width, height, rays, sun }]) => {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        this.ctx.fillRect(0, 0, width, height);

        // Number of lines to draw within the upper-right quarter
        const numLines = 15;
        const angleStep = Math.PI / (2 * numLines); // Spread across the upper-right quarter
        const textSpacing = 12; // Spacing between letters on each line
        const textHeight = this.fontSize;

        // Loop through each line in the upper-right quarter and draw letters inside the sun body
        for (let i = 0; i < numLines; i++) {
          // Calculate angle for the current line
          const angle = i * angleStep;

          // Calculate Y offset for vertical positioning along the arc
          const yOffset = sun.y + sun.radius * Math.sin(angle);

          // Start drawing letters from the edge of the sun body
          let xOffset = sun.x + sun.radius * Math.cos(angle);

          // Loop through each letter position on the line
          for (let j = 0; j < sun.radius; j++) {
            // Calculate a scaling factor based on the distance from the center
            const scaleFactor = 1 - j / sun.radius;

            // Adjust xOffset based on the scale factor and text spacing
            xOffset -= textSpacing * scaleFactor; // Subtract to move inward

            // Ensure the letters stay inside the sun body
            if (xOffset > sun.x) {
              // Random letter and color
              const letter = this.letterArray[Math.floor(Math.random() * this.letterArray.length)];
              const color = this.colorPalette[Math.floor(Math.random() * this.colorPalette.length)];

              // Clear a rectangular area around the letter's position
              this.ctx.fillStyle = 'black';
              this.ctx.fillRect(xOffset - textSpacing / 2, yOffset - textHeight / 2, textSpacing, textHeight);

              // Set color and draw the letter
              this.ctx.fillStyle = color;
              this.ctx.fillText(letter, xOffset, yOffset);
            }
          }
        }

        rays.forEach((ray: any) => {
          let x = Math.cos(ray.angle) * ray.position * this.fontSize;
          let y = Math.sin(ray.angle) * ray.position * this.fontSize;

          // Color and text for the ray
          const text = this.letterArray[Math.floor(Math.random() * this.letterArray.length)];
          const color = this.colorPalette[Math.floor(Math.random() * this.colorPalette.length)];
          this.ctx.fillStyle = color;
          this.ctx.fillText(text, x, y);

          // Advance position for shimmering effect
          ray.position = (ray.position * this.fontSize > height && Math.random() > 0.9) ? 10 : ray.position + 1;
        });
      })
    );

    this.scene$ =  resize$.pipe(
      tap(({ width, height }) => {
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }),
      switchMap(() => draw$),
      takeUntil(this.destroy$)
    );

    this.scene$.subscribe();
  }

  private getCanvasSize() {
    return {
      width: window.innerWidth,
      height: window.innerHeight
    };
  }
}
