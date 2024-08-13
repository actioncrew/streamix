import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<canvas #canvas></canvas>',
  styles: ['canvas { display: block; }'],
})
export class AppComponent implements AfterViewInit {
  @ViewChild('canvas', { static: false })
  canvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private particles: any[] = [];
  private text = 'Streamix';
  private whirlpoolCenterX = 0;
  private whirlpoolCenterY = 0;
  private whirlpoolRadius = Math.max(window.innerWidth, window.innerHeight);
  private whirlpoolSpeed = 0.03;
  private formingText = false;
  private animationStopped = false;
  private targetPositions: { [key: string]: { x: number; y: number } } = {};
  private animationState:
    | 'initial'
    | 'forming'
    | 'delay'
    | 'destruction'
    | 'reformation' = 'initial';
  private frameCount = 0;
  private delayFrames = 60;
  private ribbons: any[] = [];
  private rectangles: any[] = [];

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.setupCanvas();
    this.createParticles();
    this.createRectangles();
    this.createRibbons();
    this.animate();
  }

  private setupCanvas() {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = window.innerWidth - 20;
    canvas.height = window.innerHeight - 20;
    this.whirlpoolCenterX = canvas.width / 2;
    this.whirlpoolCenterY = canvas.height / 2;
  }

  private createParticles() {
    this.ctx.font = 'bold 100px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(this.text, this.whirlpoolCenterX, this.whirlpoolCenterY);
    const imageData = this.ctx.getImageData(
      0,
      0,
      this.ctx.canvas.width,
      this.ctx.canvas.height
    );

    this.targetPositions = {};
    this.particles = [];

    for (let y = 0; y < this.ctx.canvas.height; y++) {
      for (let x = 0; x < this.ctx.canvas.width; x++) {
        const index = (y * this.ctx.canvas.width + x) * 4;
        const alpha = imageData.data[index + 3];
        if (alpha > 128) {
          this.targetPositions[`${x},${y}`] = {
            x:
              this.whirlpoolCenterX -
              this.ctx.measureText(this.text).width / 2 +
              (x -
                this.whirlpoolCenterX +
                this.ctx.measureText(this.text).width / 2),
            y:
              this.whirlpoolCenterY -
              (this.ctx.measureText(this.text).actualBoundingBoxAscent +
                this.ctx.measureText(this.text).actualBoundingBoxDescent) /
                2 +
              (y -
                this.whirlpoolCenterY +
                (this.ctx.measureText(this.text).actualBoundingBoxAscent +
                  this.ctx.measureText(this.text).actualBoundingBoxDescent) /
                  2),
          };
          this.particles.push({
            x:
              this.whirlpoolCenterX +
              (Math.random() - 0.5) * this.whirlpoolRadius * 2,
            y:
              this.whirlpoolCenterY +
              (Math.random() - 0.5) * this.whirlpoolRadius * 2,
            targetX: x,
            targetY: y,
            angle: Math.random() * Math.PI * 2,
            speed: Math.random() * 2 + 1,
            state: 'moving',
            speedX: Math.random() * 2 - 1,
            speedY: Math.random() * 2 - 1,
            color: `rgba(${imageData.data[index]}, ${
              imageData.data[index + 1]
            }, ${imageData.data[index + 2]}, ${
              imageData.data[index + 3] / 255
            })`,
            phase: 'formation',
          });
        }
      }
    }
  }

  private createReformationParticles() {
    this.ctx.font = 'bold 100px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(this.text, this.whirlpoolCenterX, this.whirlpoolCenterY);

    const imageData = this.ctx.getImageData(
      0,
      0,
      this.ctx.canvas.width,
      this.ctx.canvas.height
    );

    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

    this.targetPositions = {};
    this.particles = [];

    for (let y = 0; y < this.ctx.canvas.height; y++) {
      for (let x = 0; x < this.ctx.canvas.width; x++) {
        const index = (y * this.ctx.canvas.width + x) * 4;
        const alpha = imageData.data[index + 3];
        if (alpha > 128) {
          const targetX = x;
          const targetY = y;
          this.targetPositions[`${x},${y}`] = { x: targetX, y: targetY };

          let initialX, initialY;
          const border = Math.floor(Math.random() * 4);

          switch (border) {
            case 0:
              initialX = Math.random() * this.ctx.canvas.width;
              initialY = 0;
              break;
            case 1:
              initialX = this.ctx.canvas.width;
              initialY = Math.random() * this.ctx.canvas.height;
              break;
            case 2:
              initialX = Math.random() * this.ctx.canvas.width;
              initialY = this.ctx.canvas.height;
              break;
            case 3:
              initialX = 0;
              initialY = Math.random() * this.ctx.canvas.height;
              break;
          }

          this.particles.push({
            x: initialX,
            y: initialY,
            targetX: targetX,
            targetY: targetY,
            angle: Math.random() * Math.PI * 2,
            speed: Math.random() * 2 + 1,
            state: 'moving',
            speedX: (targetX - initialX!) / 50,
            speedY: (targetY - initialY!) / 50,
            color: `rgba(${imageData.data[index]}, ${
              imageData.data[index + 1]
            }, ${imageData.data[index + 2]}, ${
              imageData.data[index + 3] / 255
            })`,
            phase: 'reformation',
          });
        }
      }
    }
  }

  private createRibbons() {
    const canvasWidth = this.canvasRef.nativeElement.width;
    const canvasHeight = this.canvasRef.nativeElement.height;
    const ribbonWidth = 10; // Width of the ribbon

    this.ribbons = [];

    // Create horizontal ribbons
    for (let y = 0; y < canvasHeight; y += ribbonWidth) {
      this.ribbons.push({
        x: -ribbonWidth,
        y: y,
        width: canvasWidth + ribbonWidth * 2,
        height: ribbonWidth,
        color: 'rgba(255, 0, 0, 0.5)', // Example color
        speed: 2,
        direction: 'horizontal',
      });
    }

    // Create vertical ribbons
    for (let x = 0; x < canvasWidth; x += ribbonWidth) {
      this.ribbons.push({
        x: x,
        y: -ribbonWidth,
        width: ribbonWidth,
        height: canvasHeight + ribbonWidth * 2,
        color: 'rgba(0, 0, 255, 0.5)', // Example color
        speed: 2,
        direction: 'vertical',
      });
    }
  }

  private animate() {
    if (this.animationStopped) return;

    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

    switch (this.animationState) {
      case 'initial':
      case 'forming':
        this.animateFormation();
        break;
      case 'delay':
        this.renderParticles();
        this.frameCount++;
        if (this.frameCount >= this.delayFrames) {
          this.animationState = 'destruction';
          this.frameCount = 0;
        }
        break;
      case 'destruction':
        this.animateCaptionDestruction();
        break;
      case 'reformation':
        this.animateReformation();
        break;
    }

    if (!this.animationStopped) {
      requestAnimationFrame(() => this.animate());
    }
  }

  private renderParticles() {
    this.particles.forEach((p) => {
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  private animateFormation() {
    this.ctx.clearRect(0, 0, this.canvasRef.nativeElement.width, this.canvasRef.nativeElement.height);
    this.particles.forEach((p) => {
      if (p.phase === 'formation') {
        if (!this.formingText) {
          const dx = p.x - this.whirlpoolCenterX;
          const dy = p.y - this.whirlpoolCenterY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) + this.whirlpoolSpeed;
          p.x = this.whirlpoolCenterX + Math.cos(angle) * distance;
          p.y = this.whirlpoolCenterY + Math.sin(angle) * distance;
        }

        if (this.formingText) {
          const dx = p.targetX - p.x;
          const dy = p.targetY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 2) {
            p.x = p.targetX;
            p.y = p.targetY;
            p.state = 'static';
          } else {
            p.x += dx * 0.05;
            p.y += dy * 0.05;
          }
        }

        if (p.state === 'falling') {
          p.y += p.speed;
        }
      }

      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      this.ctx.fill();
    });

    if (this.formingText && this.particles.every((p) => p.state === 'static')) {
      this.animationState = 'delay';
      this.frameCount = 0;
    } else if (!this.formingText) {
      this.formingText = true;
    }
  }

  private animateCaptionDestruction() {
    const width = this.canvasRef.nativeElement.width;
    const height = this.canvasRef.nativeElement.height;

    this.ctx.clearRect(0, 0, width, height);

    let allParticlesBelowCanvas = true;

    this.particles.forEach((p) => {
      if (p.phase === 'formation') {
        p.x += p.speedX;
        p.y += p.speedY;

        p.speedY += 0.05; // gravity
        p.speedX += Math.random() * 0.2 - 0.1; // wind effect

        if (p.y < height && p.x > 0 && p.x < width) {
          this.ctx.fillStyle = p.color;
          this.ctx.fillRect(p.x, p.y, 2, 2);
          allParticlesBelowCanvas = false;
        }
      }
    });

    if (allParticlesBelowCanvas) {
      this.animationState = 'reformation'; // Transition to Reformation phase
      this.createReformationParticles();
    }
  }

  private animateReformation() {
    this.ctx.clearRect(0, 0, this.canvasRef.nativeElement.width, this.canvasRef.nativeElement.height);

    this.particles.forEach((p) => {
      if (p.phase === 'reformation') {
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 2) {
          p.x = p.targetX;
          p.y = p.targetY;
          p.state = 'static';
        } else {
          p.x += dx * 0.05;
          p.y += dy * 0.05;
        }
      }

      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      this.ctx.fill();
    });

    if (this.particles.every((p) => p.state === 'static') && this.animationState === 'reformation') {
      this.animateRectangles(); // Start ribbon animation after reformation
      this.drawTextWithOutline();
    }
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

    this.rectangles = [];

    for (let i = 0; i < 100; i++) {
      // Create 100 rectangles
      this.rectangles.push({
        x: Math.random() * canvasWidth,
        y: Math.random() * canvasHeight,
        width: rectangleSize,
        height: rectangleSize,
        color: `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${
          Math.random() * 255
        }, 0.5)`, // Random color
        speedX: (Math.random() - 0.5) * 4, // Random speed in X direction
        speedY: (Math.random() - 0.5) * 4, // Random speed in Y direction
      });
    }
  }

  private animateRectangles() {
    if (this.animationStopped) return;

    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

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

    if (!this.animationStopped) {
      requestAnimationFrame(() => this.animate());
    }
  }
}
