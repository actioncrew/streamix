// image-processor.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { FileSizePipe } from './file-size.pipe';
import { ImagePipelineService } from './image-pipeline.service';
import { ProcessedResult } from './image-processing.utils';

@Component({
  selector: 'app-root',
  template: `
    <h2>Smart Image Processor 🚀</h2>
    <p><strong>Drop or select images</strong></p>
    <input type="file" multiple (change)="onFiles($event)" />
    <div class="preview">
      <div *ngFor="let img of images">
        <img [src]="img.url" width="200" />
        <p>{{ img.originalSize | filesize }} → {{ img.finalSize | filesize }} ({{ img.saved | filesize }} saved)</p>
      </div>
    </div>
  `,
  styles: [`
    .preview { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
    img { border: 1px solid #ccc; border-radius: 4px; }
  `],
  imports: [CommonModule, FileSizePipe],
  standalone: true
})
export class ImageProcessorComponent implements OnDestroy {
  images: ProcessedResult[] = [];

  private sub: any;

  constructor(private pipeline: ImagePipelineService) {
    // Subscribe to results
    this.sub = this.pipeline.resultStream.subscribe((img) => {
      this.images = [...this.images, img];
    });
  }

  onFiles(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      Array.from(input.files).forEach(file => this.pipeline.uploadFile(file));
    }
  }

  ngOnDestroy() {
    this.sub?.unsubscribe?.();
    this.pipeline.ngOnDestroy();
  }
}
