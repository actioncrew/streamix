import { concatMap, delay, finalize, map, of, range, reduce, scan, Stream, tap } from '@actioncrew/streamix';
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'app2';

  canvas!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;

  width!: number;
  height!: number;
  maxIterations!: number;
  zoom!: number;
  centerX!: number;
  centerY!: number;
  panX!: number;
  panY!: number;
  subSampling!: number;

  fractal$!: Stream;
  average$!: Stream;

  ngOnInit(): void {
    this.canvas = document.getElementById('mandelbrotCanvas')! as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;

    this.canvas.width = 100;
    this.canvas.height = 100;

    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.maxIterations = 20;
    this.zoom = 50;
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;
    this.panX = 0.5;
    this.panY = 0;
    this.subSampling = 2;

    this.showProgressOverlay();
    this.drawFractal().subscribe();
  }

  showProgressOverlay() {
    document.getElementById('progress-overlay')!.classList.remove('hidden');
  }

  hideProgressOverlay() {
    document.getElementById('progress-overlay')!.classList.add('hidden');
  }

  updateProgressBar(progress: number) {
    const progressBar = document.getElementById('progress');
    const progressText = document.getElementById('progress-text');
    progressBar!.style.width = `${progress}%`;
    progressText!.textContent = `Processing... ${Math.round(progress)}%`;
  }

  mandelbrot(cx: number, cy: number): number {
    let x = 0, y = 0;
    for (let i = 0; i < this.maxIterations; i++) {
      const x2 = x * x, y2 = y * y;
      if (x2 + y2 > 4) return i;
      y = 2 * x * y + cy;
      x = x2 - y2 + cx;
    }
    return this.maxIterations;
  }

  getColor(iteration: number): [number, number, number] {
    if (iteration === this.maxIterations) return [0, 0, 0]; // Black for points in the set
    const hue = (iteration / 50) % 1;
    const saturation = 1;
    const value = iteration < this.maxIterations ? 1 : 0;
    let r, g, b;

    const i = Math.floor(hue * 6);
    const f = hue * 6 - i;
    const p = value * (1 - saturation);
    const q = value * (1 - f * saturation);
    const t = value * (1 - (1 - f) * saturation);

    switch (i % 6) {
      case 0: r = value, g = t, b = p; break;
      case 1: r = q, g = value, b = p; break;
      case 2: r = p, g = value, b = t; break;
      case 3: r = p, g = q, b = value; break;
      case 4: r = t, g = p, b = value; break;
      case 5: r = value, g = p, b = q; break;
    }

    return [Math.round(r! * 255), Math.round(g! * 255), Math.round(b! * 255)];
  }

  drawFractal(): Stream {
    const imageData = this.ctx.createImageData(this.width, this.height);
    const data = imageData.data;

    this.fractal$ = range(0, this.width * this.height).pipe(
      concatMap((i: number) => {
        const px = i % this.width;
        const py = Math.floor(i / this.width);
        // Process sub-pixels and calculate average color
        return this.average$ = range(0, this.subSampling * this.subSampling).pipe(
          concatMap(() => {
            const subPixelX = Math.random() / this.subSampling;
            const subPixelY = Math.random() / this.subSampling;
            const x0 = (px + subPixelX - this.centerX) / this.zoom - this.panX;
            const y0 = (py + subPixelY - this.centerY) / this.zoom - this.panY;
            const iteration = this.mandelbrot(x0, y0);
            return of(this.getColor(iteration));
          }),
          reduce((acc, rgb) => {
            acc[0] += rgb[0];
            acc[1] += rgb[1];
            acc[2] += rgb[2];
            return acc;
          }, [0, 0, 0]),
          map(total => ({
            i,
            r: total[0] / (this.subSampling * this.subSampling),
            g: total[1] / (this.subSampling * this.subSampling),
            b: total[2] / (this.subSampling * this.subSampling)
          })),
          delay(0),
        );
      }),
      tap(({ i, r, g, b }) => {
        const index = i * 4;
        data[index] = r;
        data[index + 1] = g;
        data[index + 2] = b;
        data[index + 3] = 255;
      }),
      scan((acc, _, index) => {
        const progress = ((index! + 1) / (this.width * this.height)) * 100;
        this.updateProgressBar(progress);
        return acc;
      }, 0),
      finalize(() => {
        this.ctx.putImageData(imageData, 0, 0);
        this.hideProgressOverlay();
      })
    );
    return this.fractal$;
  }
}
