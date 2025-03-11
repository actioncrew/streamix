import { interval, scan, startWith, tap } from '@actioncrew/streamix';
import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';

@Component({
  selector: 'app-motion',
  standalone: true,
  template: '<canvas #canvas></canvas>',
  styles: ['canvas { display: block; }'],
})
export class AppMotionComponent implements AfterViewInit {
  @ViewChild('canvas', { static: false })
  canvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private rectangles: any[] = [];
  private text = 'Streamix';
  private animationStopped = false;

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.setupCanvas();
    this.createRectangles();

    // Create an observable for animation frames
    const animationFrames$ = interval(1000 / 60).pipe(
      startWith(0), // Start immediately
      scan(acc => acc + 1, 0), // Increment frame count
      tap(() => {
        if (!this.animationStopped) {
          this.animate();
        }
      })
    );

    // Start the animation
    animationFrames$.subscribe();
  }

  private setupCanvas() {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = window.innerWidth - 20;
    canvas.height = window.innerHeight - 20;
  }

  private animate() {
    if (this.animationStopped) return;

    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

    // Animate rectangles and draw text
    this.animateRectangles();
    this.drawTextWithOutline();
  }

  private drawTextWithOutline() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = this.ctx;

    ctx.font = 'bold 100px Arial'; // Set font style and size
    ctx.textAlign = 'center'; // Align text to center
    ctx.textBaseline = 'middle'; // Baseline of text

    // Draw text stroke
    ctx.strokeStyle = 'black'; // Set stroke color
    ctx.lineWidth = 2; // Set stroke width
    ctx.strokeText(this.text, canvas.width / 2, canvas.height / 2);

    // Draw text fill
    ctx.fillStyle = 'black'; // Set fill color
    ctx.fillText(this.text, canvas.width / 2, canvas.height / 2);
  }

  private createRectangles() {
    const canvasWidth = this.canvasRef.nativeElement.width;
    const canvasHeight = this.canvasRef.nativeElement.height;
    const rectangleSize = 20; // Size of the rectangle

    this.rectangles = Array.from({ length: 100 }, () => ({
      x: Math.random() * canvasWidth,
      y: Math.random() * canvasHeight,
      width: rectangleSize,
      height: rectangleSize,
      color: `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.5)`,
      speedX: (Math.random() - 0.5) * 4, // Random speed in X direction
      speedY: (Math.random() - 0.5) * 4, // Random speed in Y direction
    }));
  }

  private animateRectangles() {
    if (this.animationStopped) return;

    this.rectangles.forEach((rect) => {
      // Draw the rectangle
      this.ctx.fillStyle = rect.color;
      this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

      // Update the rectangle position
      rect.x += rect.speedX;
      rect.y += rect.speedY;

      // Bounce off the edges
      if (rect.x < 0 || rect.x + rect.width > this.ctx.canvas.width) {
        rect.speedX *= -1;
      }
      if (rect.y < 0 || rect.y + rect.height > this.ctx.canvas.height) {
        rect.speedY *= -1;
      }
    });
  }
}
