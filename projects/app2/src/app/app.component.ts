import { compute, concatMap, coroutine, debounce, finalize, map, mergeMap, onResize, range, scan, startWith, Stream, tap } from '@actioncrew/streamix';
import { Component, OnInit } from '@angular/core';

// Main Mandelbrot computation function
function computeMandelbrot(data: { px: number, py: number, maxIterations: number, zoom: number, centerX: number, centerY: number, panX: number, panY: number }) {
  const { px, py, maxIterations, zoom, centerX, centerY, panX, panY } = data;
  let x = 0, y = 0;
  const x0 = (px - centerX) / zoom - panX;
  const y0 = (py - centerY) / zoom - panY;
  for (let i = 0; i < maxIterations; i++) {
    const x2 = x * x, y2 = y * y;
    if (x2 + y2 > 4) {
      // Calculate color based on iteration count
      const { r, g, b } = computeColor(i, maxIterations);
      return {px, py, r, g, b};
    }
    y = 2 * x * y + y0;
    x = x2 - y2 + x0;
  }
  // If maxIterations reached, return black (no color)
  return {px, py, r: 0, g: 0, b: 0};
}

// Compute color function
function computeColor(iteration: number, maxIterations: number): { r: number, g: number, b: number } {
  if (iteration === maxIterations) return { r: 0, g: 0, b: 0 }; // Black for points in the set

  const hue = (iteration / 50) % 1;
  const saturation = 1;
  const value = iteration < maxIterations ? 1 : 0;
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

  return { r: Math.round(r! * 255), g: Math.round(g! * 255), b: Math.round(b! * 255) };
}

function computeMandelbrotInChunks(data: { index: number, width: number, height: number, maxIterations: number, zoom: number, centerX: number, centerY: number, panX: number, panY: number }) {
  const { index, width, height, maxIterations, zoom, centerX, centerY, panX, panY } = data;
  const chunkSize = 1000;
  const result: { px: number, py: number, r: number, g: number, b: number }[] = [];
  const end = Math.min(index + chunkSize, width * height);
  for (let i = index; i < end; i++) {
    const chunkData = {
      index: i,
      width,
      height,
      maxIterations,
      zoom,
      centerX,
      centerY,
      panX,
      panY
    };

    const px = (chunkData.index % width);
    const py = Math.floor(chunkData.index / width);
    result.push(computeMandelbrot({
      px,
      py,
      maxIterations,
      zoom,
      centerX,
      centerY,
      panX,
      panY
    }));
  }

  return result;
}

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
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
    this.fractal$ = this.drawFractal();
    this.fractal$.subscribe();
  }

  showProgressOverlay() {
    this.updateProgressBar(0);
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

  drawFractal(): Stream {
    // Create ComputeOperator instance
    const task = coroutine(computeMandelbrotInChunks, computeMandelbrot, computeColor);
    this.canvas = document.getElementById('mandelbrotCanvas')! as HTMLCanvasElement;

    return onResize(this.canvas).pipe(
      debounce(100),
      startWith({ width: window.innerWidth, height: window.innerHeight }),
      tap(() => {
        this.showProgressOverlay();
      }),
      concatMap(({width, height}: any) => {
        this.canvas.width = width;
        this.canvas.height = height;

        this.ctx = this.canvas.getContext('2d')!;
        this.ctx.clearRect(0, 0, this.width, this.height);

        const imageData = this.ctx.createImageData(width, height);
        const data = imageData.data;

        this.width = width;
        this.height = height;
        this.maxIterations = 20;
        this.zoom = 200;
        this.centerX = width / 2;
        this.centerY = height / 2;
        this.panX = 0.5;
        this.panY = 0;
        this.subSampling = 4;

        return range(0, width * height, 1000).pipe(
          map(index => ({ index, width, height, maxIterations: this.maxIterations, zoom: this.zoom, centerX: this.centerX, centerY: this.centerY, panX: this.panX, panY: this.panY })),
          mergeMap((params) => compute(task, params)),
          tap((result: any) => {
            result.forEach(({ px, py, r, g, b }: any) => {
              const i = py * width + px;
              const index = i * 4;
              data[index] = r;
              data[index + 1] = g;
              data[index + 2] = b;
              data[index + 3] = 255;
            });
          }),
          scan((acc, _, index) => {
            const progress = ((index! + 1) * 1000 / (width * height)) * 100; // Adjusted progress calculation for batching
            requestAnimationFrame(() => this.updateProgressBar(progress)); // Use requestAnimationFrame for smoother updates
            return acc;
          }, 0),
          finalize(() => {
            this.ctx.putImageData(imageData, 0, 0);
            this.hideProgressOverlay();
          })
      )}),
      finalize(() => {
        task.finalize();
      })
    )
  }
}
