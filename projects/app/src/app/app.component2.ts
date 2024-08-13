import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<canvas #canvas></canvas>',
  styles: ['canvas { display: block; }']
})
export class AppComponent implements AfterViewInit {
  @ViewChild('canvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private particles: any[] = [];
  private text = 'Streamix';
  private mouseX = 0;
  private mouseY = 0;
  private isMouseOver = false;
  private colorPalette = ['#0f0', '#f0f', '#0ff', '#f00', '#ff0'];

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.setupCanvas();
    this.createParticles();
    this.addEventListeners();
    this.animate();
  }

  private setupCanvas() {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  private createParticles() {
    this.ctx.font = 'bold 100px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const centerY = this.ctx.canvas.height / 2;

    // Calculate total width of the text
    const totalWidth = this.ctx.measureText(this.text).width;
    let startX = (this.ctx.canvas.width - totalWidth) / 2;

    // Clear the canvas before drawing
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

    for (let i = 0; i < this.text.length; i++) {
      const letter = this.text[i];
      const color = this.colorPalette[i % this.colorPalette.length];

      this.ctx.fillStyle = color;

      // Get the width of the current letter
      const letterWidth = this.ctx.measureText(letter).width;

      // Draw the letter
      this.ctx.fillText(letter, startX + letterWidth / 2, centerY);

      // Move startX to the right for the next letter
      startX += letterWidth;
    }

    const imageData = this.ctx.getImageData(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

    this.particles = []; // Clear previous particles

    for (let y = 0; y < this.ctx.canvas.height; y += 4) {
      for (let x = 0; x < this.ctx.canvas.width; x += 4) {
        const index = (y * this.ctx.canvas.width + x) * 4;
        const alpha = imageData.data[index + 3];
        if (alpha > 128) {
          const red = imageData.data[index];
          const green = imageData.data[index + 1];
          const blue = imageData.data[index + 2];
          const color = `rgb(${red},${green},${blue})`;
          this.particles.push({
            x: x,
            y: y,
            origX: x,
            origY: y,
            size: 3,
            color: color,
            speed: 0,
            state: 'static'
          });
        }
      }
    }
  }

  private addEventListeners() {
    const canvas = this.canvasRef.nativeElement;
    canvas.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.checkMouseProximity();
    });
    canvas.addEventListener('mouseenter', () => this.checkMouseProximity());
    canvas.addEventListener('mouseleave', () => this.isMouseOver = false);
  }

  private checkMouseProximity() {
    this.isMouseOver = this.particles.some(p => {
      if (p.state === 'static') {
        const dx = p.x - this.mouseX;
        const dy = p.y - this.mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < 100;
      } else {
        return false;
      }
    });
  }

  private animate() {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

    for (const p of this.particles) {
      if (this.isMouseOver) {
        const dx = p.x - this.mouseX;
        const dy = p.y - this.mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 100 && p.state === 'static') {
          p.state = 'falling';
          p.speed = Math.random() * 2 + 1;
        }
      }

      if (p.state === 'falling') {
        p.y += p.speed;
        p.x += (Math.random() - 0.5) * 2;
        p.speed += 0.1;
      }

      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(p.x, p.y, p.size, p.size);
    }

    this.particles = this.particles.filter(p => p.y < this.ctx.canvas.height);
    if(this.particles.length === 0) {
      this.createParticles();
    }
    requestAnimationFrame(() => this.animate());
  }
}
