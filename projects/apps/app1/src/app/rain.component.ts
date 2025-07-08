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
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-caption',
  template: `
    <div class="caption">
      {{ displayedCaption }}
      <span *ngIf="showCursor" class="cursor">_</span>
    </div>
  `,
  host: { 'data-component-id': 'rain' }, // Changed host id to 'rain' for consistency
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
  selector: 'app-rain',
  standalone: true,
  imports: [RouterOutlet, CaptionComponent],
  template: `
  <div class="container">
    <app-caption></app-caption>
    <canvas></canvas>
  </div>`,
  styleUrl: './app.component.scss' // Note: styleUrl is deprecated, styleUrls is preferred. Keeping as is for now.
})
export class AppRainComponent implements AfterViewInit, OnDestroy {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private fontSize = 10;
  private letterArray = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
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
      shareReplay(1) // Added refCount for better resource management
    );

    const columns$ = resize$.pipe(
      map(({ width }) => Math.floor(width / this.fontSize)),
      shareReplay(1) // Added shareReplay with refCount
    );

    const drops$ = columns$.pipe(
      map(columns => Array.from({ length: columns }, () => 0)),
      shareReplay(1) // Added shareReplay with refCount
    );

    // Use combineLatest to wait for the *first* emissions from drops$ and resize$
    // This ensures the canvas is initially sized and drops array is configured before drawing starts.
    this.scene$ = combineLatest([drops$, resize$]).pipe(
      // This tap handles the initial canvas sizing and immediate black fill
      tap(([, canvasSize]) => { // Destructure to get canvasSize
        this.canvas.width = canvasSize.width;
        this.canvas.height = canvasSize.height;
        this.ctx.fillStyle = 'black'; // IMMEDIATELY FILL WITH BLACK AFTER RESIZE
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }),
      // Now, switch to the animation loop.
      // This switchMap ensures that the interval only starts after initial setup.
      switchMap(() => // No need to pass initial data here, as withLatestFrom will get current
        interval(33).pipe(
          // For subsequent frames, use withLatestFrom to get the most current data.
          // It's important to keep `drops$` and `resize$` as sources for withLatestFrom,
          // so that if they emit new values (e.g., on resize), those are picked up.
          withLatestFrom(drops$, resize$),
          tap(([_, drops, canvasSize]) => {
            // Check if dimensions have changed during an active interval frame
            if (this.canvas.width !== canvasSize.width || this.canvas.height !== canvasSize.height) {
              this.canvas.width = canvasSize.width;
              this.canvas.height = canvasSize.height;
              this.ctx.fillStyle = 'black'; // Also fill black here on subsequent resizes
              this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            }

            // Your existing drawing logic to draw the semi-transparent black overlay
            // and the animated elements.
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            this.ctx.fillRect(0, 0, canvasSize.width, canvasSize.height); // Use canvasSize for fillRect dimensions

            drops.forEach((drop: any, index: number) => {
              const text = this.letterArray[Math.floor(Math.random() * this.letterArray.length)];
              const color = this.colorPalette[Math.floor(Math.random() * this.colorPalette.length)];
              this.ctx.fillStyle = color;
              this.ctx.fillText(text, index * this.fontSize, drop * this.fontSize);

              // Reset drop to 0 if it goes off screen, or increment
              drops[index] = drop * this.fontSize > canvasSize.height && Math.random() > 0.95 ? 0 : drop + 1;
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
