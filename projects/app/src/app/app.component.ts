import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { combineLatest, concat, from, Subject, take } from 'streamix';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'streamix';
  firstTimer = from([1,2,3]); // emit 0, 1, 2... every second, starting immediately
  secondTimer = new Subject(); // emit 0, 1, 2... every second, starting 0.5 seconds from now

  combinedTimers = from([1,2,3,4,5]).pipe(take(2));
  combinedTimers2 = combineLatest([this.firstTimer, this.secondTimer]).pipe(take(20));
  concatStreams = concat(this.combinedTimers, this.combinedTimers2).subscribe((value) => console.log(value));
  async ngOnInit(): Promise<void> {
    let timeout = setTimeout(() => {
      this.concatStreams.unsubscribe();
    }, 10000);

    await this.secondTimer.next(1);
    await this.secondTimer.next(2);
    await this.secondTimer.next(3);
    await this.secondTimer.next(4);
    await this.secondTimer.next(5);
    await this.secondTimer.complete();
  }
}
