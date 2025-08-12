// file-size.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
const FILE_SIZE_THRESHOLD = 1024;

@Pipe({
  name: 'filesize',
  standalone: true
})
export class FileSizePipe implements PipeTransform {
  transform(sizeInBytes: number | string | null | undefined): string {
    const size = typeof sizeInBytes === 'string' ? parseFloat(sizeInBytes) : sizeInBytes;

    if (size === null || size === undefined || isNaN(size)) {
      return 'N/A';
    }

    if (size === 0) {
      return '0 B';
    }

    const absSize = Math.abs(size);
    const i = Math.floor(Math.log(absSize) / Math.log(FILE_SIZE_THRESHOLD));
    const formattedSize = `${(absSize / Math.pow(FILE_SIZE_THRESHOLD, i)).toFixed(2)} ${FILE_SIZE_UNITS[i]}`;

    return size < 0 ? `-${formattedSize}` : formattedSize;
  }
}
