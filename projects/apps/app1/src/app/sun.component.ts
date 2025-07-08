import {
  combineLatest,
  createSubject,
  fromEvent,
  interval,
  map,
  shareReplay,
  startWith,
  Stream,
  switchMap,
  takeUntil,
  tap,
  timer,
  withLatestFrom,
} from '@actioncrew/streamix';
import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';

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
  imports: [CaptionComponent],
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
  private scene$!: Stream;

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
      map(() => this.getCanvasSize()),
      shareReplay(1)
    );

    const rays$ = resize$.pipe(
      map(({ width, height }) => ({
        width,
        height,
        rays: Array.from({ length: 30 }, (_, i) => ({
          angle: (i / 30) * Math.PI / 2,
          position: 10,
        })),
        sun: {
          x: 0,
          y: 0,
          radius: 120,
        }
      })),
      shareReplay(1)
    );

    this.scene$ = combineLatest([rays$, resize$]).pipe(
      // This tap handles the initial canvas sizing and immediate black fill
      tap(([, canvasSize]) => {
        this.canvas.width = canvasSize.width;
        this.canvas.height = canvasSize.height;
        this.ctx.fillStyle = 'black'; // <--- IMMEDIATELY FILL WITH BLACK AFTER RESIZE
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }),
      switchMap(() =>
        interval(33).pipe(
          withLatestFrom(rays$, resize$),
          tap(([_, raysData, canvasSize]) => {
            // Check if dimensions have changed during an active interval frame
            // This ensures that if a resize happens mid-frame, it's also handled.
            // However, the `tap` before `switchMap` is the primary fix for the flicker.
            if (this.canvas.width !== canvasSize.width || this.canvas.height !== canvasSize.height) {
              this.canvas.width = canvasSize.width;
              this.canvas.height = canvasSize.height;
              this.ctx.fillStyle = 'black'; // <--- Also fill black here on subsequent resizes
              this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            }

            // Your existing drawing logic to draw the semi-transparent black overlay
            // and the animated elements. This will now draw *over* the solid black background.
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            this.ctx.fillRect(0, 0, raysData.width, raysData.height);

            // ... (rest of your drawing logic for sun and rays)
            const numLines = 15;
            const angleStep = Math.PI / (2 * numLines);
            const textSpacing = 12;
            const textHeight = this.fontSize;

            for (let i = 0; i < numLines; i++) {
              const angle = i * angleStep;
              const yOffset = raysData.sun.y + raysData.sun.radius * Math.sin(angle);
              let xOffset = raysData.sun.x + raysData.sun.radius * Math.cos(angle);

              for (let j = 0; j < raysData.sun.radius; j++) {
                const scaleFactor = 1 - j / raysData.sun.radius;
                xOffset -= textSpacing * scaleFactor;

                if (xOffset > raysData.sun.x) {
                  const letter = this.letterArray[Math.floor(Math.random() * this.letterArray.length)];
                  const color = this.colorPalette[Math.floor(Math.random() * this.colorPalette.length)];

                  this.ctx.fillStyle = 'black';
                  this.ctx.fillRect(xOffset - textSpacing / 2, yOffset - textHeight / 2, textSpacing, textHeight);

                  this.ctx.fillStyle = color;
                  this.ctx.fillText(letter, xOffset, yOffset);
                }
              }
            }

            raysData.rays.forEach((ray: any) => {
              let x = Math.cos(ray.angle) * ray.position * this.fontSize;
              let y = Math.sin(ray.angle) * ray.position * this.fontSize;

              const text = this.letterArray[Math.floor(Math.random() * this.letterArray.length)];
              const color = this.colorPalette[Math.floor(Math.random() * this.colorPalette.length)];
              this.ctx.fillStyle = color;
              this.ctx.fillText(text, x, y);

              ray.position = (ray.position * this.fontSize > raysData.height && Math.random() > 0.9) ? 10 : ray.position + 1;
            });
          })
        )
      ),
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
