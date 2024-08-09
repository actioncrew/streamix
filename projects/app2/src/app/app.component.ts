import {
  compute,
  concatMap,
  define,
  delay,
  finalize,
  from,
  map,
  mergeMap,
  range,
  scan,
  Subscribable,
  tap,
} from '@actioncrew/streamix';
import { Component, OnInit } from '@angular/core';

const BATCH_SIZE = 1000;
const DELAY_MS = 100; // Increase delay to make progress visible

// Main Mandelbrot computation function
function mandelbrotTask(data: { px: number, py: number, maxIterations: number, zoom: number, centerX: number, centerY: number, panX: number, panY: number }) {
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

function executeChunkedMandelbrotTask(data: { index: number, width: number, height: number, maxIterations: number, zoom: number, centerX: number, centerY: number, panX: number, panY: number }) {
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
    result.push(mandelbrotTask({
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

  fractal$!: Subscribable;
  average$!: Subscribable;

  ngOnInit(): void {
    this.canvas = document.getElementById('mandelbrotCanvas')! as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;

    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

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
    this.fractal$ = this.drawFractal();
    this.fractal$.subscribe();
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

  drawFractal(): Subscribable {
    const imageData = this.ctx.createImageData(this.width, this.height);
    const data = imageData.data;
    // Create ComputeOperator instance
    const task = define(executeChunkedMandelbrotTask, mandelbrotTask, computeColor);

    return range(0, this.width * this.height, 1000).pipe(
      map(index => ({ index, width: this.width, height: this.height, maxIterations: this.maxIterations, zoom: this.zoom, centerX: this.centerX, centerY: this.centerY, panX: this.panX, panY: this.panY })),
      mergeMap((params) => compute(task, params)),
      delay(0),
      concatMap(result => from(result)),
      map((emission) => {
        const { px, py, r, g, b } = emission;
        const i = py * this.width + px;
        return { i, r, g, b };
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
  }
}
