import {
  fromEvent,
  interval,
  map,
  startWith,
  Subject,
  Subscribable,
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
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CaptionComponent],
  template: `
  <div class="container">
    <app-caption></app-caption>
    <canvas></canvas>
  </div>`,
  styleUrl: './app.component.scss'
})
export class AppComponent implements AfterViewInit, OnDestroy {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private fontSize = 10;
  private letterArray = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
  private colorPalette = ['#0f0', '#f0f', '#0ff', '#f00', '#ff0'];
  private destroy$ = new Subject<void>();
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

    const columns$ = resize$.pipe(
      map(({ width }) => Math.floor(width / this.fontSize))
    );

    const drops$ = columns$.pipe(
      map(columns => Array.from({ length: columns }, () => 0))
    );

    const draw$ = interval(33).pipe(
      withLatestFrom(drops$),
      tap(([_, drops]) => {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        drops.forEach((drop: any, index: number) => {
          const text = this.letterArray[Math.floor(Math.random() * this.letterArray.length)];
          const color = this.colorPalette[Math.floor(Math.random() * this.colorPalette.length)];
          this.ctx.fillStyle = color;
          this.ctx.fillText(text, index * this.fontSize, drop * this.fontSize);

          drops[index] = drop * this.fontSize > this.canvas.height && Math.random() > 0.95 ? 0 : drop + 1;
        });
      })
    );

    this.scene$ = resize$.pipe(
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
