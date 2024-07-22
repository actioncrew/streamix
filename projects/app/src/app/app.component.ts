import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { interval, scan, tap, timer, withLatestFrom } from 'streamix';

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
      position: relative; /* Ensure the cursor is positioned relative to the caption container */
      background: transparent;
    }

    .cursor {
      position: absolute; /* Position the cursor absolutely within the caption container */
      right: 0; /* Align to the right edge of the caption container */
      top: 0; /* Align to the top edge of the caption container */
      transform: translateX(100%); /* Position it after the text */
      animation: blink 0.5s step-start infinite; /* Blink animation */
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
    const typeInterval = 200; // Adjust typing speed here

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
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements AfterViewInit {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private fontSize = 10;
  private letterArray = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
  private colorPalette = ['#0f0', '#f0f', '#0ff', '#f00', '#ff0'];

  ngAfterViewInit() {
    this.canvas = document.querySelector('canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.resizeCanvas();
    this.setupAnimation();
    window.addEventListener('resize', this.resizeCanvas.bind(this));
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.resizeCanvas.bind(this));
  }

  private resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private setupAnimation() {
    const columns = Math.floor(this.canvas.width / this.fontSize);

    const initializeDrops = (): number[] => Array.from({ length: columns }, () => 0);

    const drops$ = interval(33).pipe(
      scan((acc) => {
        return acc.map((drop: number, index: number) => {
          const y = drop * this.fontSize;
          const shouldReset = y > this.canvas.height && Math.random() > 0.95;
          return shouldReset ? 0 : drop + 1;
        });
      }, initializeDrops())
    );

    const draw$ = interval(33).pipe(
      withLatestFrom(drops$),
      tap(([_, drops]) => {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'; // Background with some transparency
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        drops.forEach((drop: number, index: number) => {
          const text = this.letterArray[Math.floor(Math.random() * this.letterArray.length)];
          const color = this.colorPalette[Math.floor(Math.random() * this.colorPalette.length)];
          this.ctx.fillStyle = color; // Apply random color from the palette
          this.ctx.fillText(text, index * this.fontSize, drop * this.fontSize);
        });
      })
    );

    draw$.subscribe((() => {}));
  }
}
