import { AbstractStream, finalize, from, map, mergeMap, range, reduce } from '@actioncrew/streamix';
import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'app2';

  ngOnInit(): void {
    const canvas = document.getElementById('mandelbrotCanvas')! as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;

    // Parameters
    const width = canvas.width;
    const height = canvas.height;
    const maxIterations = 200;
    const zoom = 250;  // Zoom level
    const centerX = width / 2;  // Centering X-coordinate
    const centerY = height / 2; // Centering Y-coordinate
    const panX = 2;    // Horizontal panning
    const panY = 1.5;  // Vertical panning
    const subSampling = 4; // Number of sub-pixels for anti-aliasing

    function mandelbrot(cx: number, cy: number, maxIterations: number) {
      let x = 0, y = 0;
      let iteration = 0;

      while (x*x + y*y <= 4 && iteration < maxIterations) {
        const xNew = x*x - y*y + cx;
        y = 2*x*y + cy;
        x = xNew;
        iteration++;
      }

      return iteration;
    }

    function getColor(iteration: number, maxIterations: number) {
      const ratio = iteration / maxIterations;
      const hue = Math.floor(360 * ratio);
      return `hsl(${hue}, 100%, 50%)`;
    }

    function hslToRgb(hsl: string) {
      const [hue, saturation, lightness] = hsl.match(/\d+/g)!.map(Number);
      const chroma = (1 - Math.abs(2 * lightness / 100 - 1)) * (saturation / 100);
      const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
      const m = lightness / 100 - chroma / 2;
      let r = 0, g = 0, b = 0;

      if (hue >= 0 && hue < 60) {
        r = chroma; g = x; b = 0;
      } else if (hue >= 60 && hue < 120) {
        r = x; g = chroma; b = 0;
      } else if (hue >= 120 && hue < 180) {
        r = 0; g = chroma; b = x;
      } else if (hue >= 180 && hue < 240) {
        r = 0; g = x; b = chroma;
      } else if (hue >= 240 && hue < 300) {
        r = x; g = 0; b = chroma;
      } else if (hue >= 300 && hue < 360) {
        r = chroma; g = 0; b = x;
      }

      r = Math.floor((r + m) * 255);
      g = Math.floor((g + m) * 255);
      b = Math.floor((b + m) * 255);

      return [r, g, b];
    }

    function drawFractal(): AbstractStream {
      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;

      return range(0, width * height).pipe(
        mergeMap(i => {
          const px = i % width;
          const py = Math.floor(i / width);

          return from(Array(subSampling * subSampling).keys()).pipe(
            map(subPixel => {
              const subX = subPixel % subSampling;
              const subY = Math.floor(subPixel / subSampling);
              const x0 = (px + (subX / subSampling) - centerX) / zoom;
              const y0 = (py + (subY / subSampling) - centerY) / zoom;
              const iteration = mandelbrot(x0, y0, maxIterations);
              const color = getColor(iteration, maxIterations);
              return hslToRgb(color);
            }),
            reduce((acc, [r, g, b]) => {
              acc.r += r;
              acc.g += g;
              acc.b += b;
              return acc;
            }, { r: 0, g: 0, b: 0 }),
            map(({ r, g, b }) => {
              const numSubPixels = subSampling * subSampling;
              const index = i * 4;
              data[index] = r / numSubPixels;
              data[index + 1] = g / numSubPixels;
              data[index + 2] = b / numSubPixels;
              data[index + 3] = 255;
            })
          );
        }),
        finalize(() => ctx.putImageData(imageData, 0, 0))
      );
    }

    drawFractal().subscribe();
  }
}
