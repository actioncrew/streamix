import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { combineLatest, concat, interval, take, timer } from 'streamix';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'streamix';
  firstTimer = interval(50); // emit 0, 1, 2... every second, starting immediately
  secondTimer = timer(25, 50); // emit 0, 1, 2... every second, starting 0.5 seconds from now

  combinedTimers = combineLatest([interval(50), timer(25, 50)]).pipe(take(20));
  combinedTimers2 = combineLatest([this.firstTimer, this.secondTimer]).pipe(take(20));
  concatStreams = concat(this.combinedTimers, this.combinedTimers2).subscribe((value) => console.log(value));
  async ngOnInit(): Promise<void> {
    let timeout = setTimeout(() => {
      this.concatStreams.unsubscribe();
    }, 10000);
  }
}
