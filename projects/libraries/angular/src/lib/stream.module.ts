import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { StreamDirective } from "./stream.directive";
import { StreamPipe } from "./stream.pipe";

@NgModule({
  declarations: [StreamPipe, StreamDirective],
  imports: [CommonModule],
  exports: [StreamPipe, StreamDirective]
})
export class StreamixModule {}
