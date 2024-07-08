import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BehaviorSubject, combineLatest, interval, map, take } from 'streamix';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'rxjs-phantom';
  subject = new BehaviorSubject(0);
  promise = this.subject.pipe(
    take(5),
    map(m => m * 2)
  );

  promise2 = combineLatest(interval(100), this.promise).pipe(
    map(([value, value2]) => value),
    map(m => m * 2)
  ).subscribe((value) => console.log(value));

  async ngOnInit(): Promise<void> {
    this.subject.next(1);
    this.subject.next(2);
    this.subject.next(3);
    this.subject.complete();
  }
}
