import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { combineLatest, interval, timer } from 'streamix';

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

  combinedTimers = combineLatest([this.firstTimer, this.secondTimer]).subscribe((value) => console.log(value));

  async ngOnInit(): Promise<void> {
    let timeout = setTimeout(() => {
      this.combinedTimers.unsubscribe();
    }, 5000);
  }
}
