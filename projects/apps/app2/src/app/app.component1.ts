import { CoroutineMessage, createCoroutine, seize, SeizedWorker, tap } from '@actioncrew/streamix';
import { Component, OnInit } from '@angular/core';

// --- Worker Function that runs the timer logic ---
// This is a single, stateful function designed to run in a web worker.
// Worker function for use in Coroutine
import { WorkerUtils } from '@actioncrew/streamix'; // Assuming types are in a file named 'types'

/**
 * A main task function that runs a countdown timer inside a Web Worker.
 * It uses WorkerUtils to report progress to the main thread.
 */
async function createTimerWorker(
  data: { initialTime: number; type: 'start' | 'reset' },
  utils: WorkerUtils
): Promise<number> {
  // Validate input
  if (typeof data.initialTime !== 'number' || isNaN(data.initialTime) || data.initialTime < 0) {
    throw new Error(`Invalid initialTime: ${data.initialTime}`);
  }

  // Initialize counter
  let counter = data.initialTime;

  // Send initial counter value
  utils.reportProgress({ tick: counter, timestamp: Date.now() });

  // Return a promise that resolves when the timer completes
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      counter--;

      // Send periodic update
      utils.reportProgress({ tick: counter, timestamp: Date.now() });

      if (counter <= 0) {
        clearInterval(timer);
        resolve(counter); // Resolve with final counter value
      }
    }, 1000);
  });
}

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'Timer App with Coroutine';
  timerValue: number = 0;
  timerStatus: string = 'Stopped';
  private seizedWorker!: SeizedWorker<any, any>;

  ngOnInit(): void {
    // The coroutine manages a pool of workers running our timer logic.
    const timerTask = createCoroutine(createTimerWorker);

    // We use the seize operator to get a single dedicated worker from the pool.
    // The stream emits a single SeizedWorker object.
    const timerWorker$ = seize(timerTask).pipe(
      // The finalize operator ensures the worker and task are cleaned up
      // when the stream is unsubscribed or completes.
      tap(console.log)
    );

    // Subscribe to the stream to get the SeizedWorker instance.
    // This is where we handle all communication with the worker.
    timerWorker$.subscribe((seizedWorker) => {
      this.seizedWorker = seizedWorker;
      // Listen for messages from the worker
      this.seizedWorker.output$.subscribe((msg: CoroutineMessage) => {
        if (msg.type === 'progress') {
          this.timerValue = msg.payload;
          console.log('Counting down...');
        } else if (msg.type === 'response') {
          console.log('Completed');
          this.seizedWorker.dispose(); // Clean up the worker after it's done
        }
      });

      // Start the timer for the first time
      this.seizedWorker.sendTask({ initialTime: 60, type: 'start' });
    });
  }

  // Method to reset the timer from the UI
  resetTimer() {
    console.log('Resetting...');
    // Send a message to the worker to reset the timer to 30 seconds
    this.seizedWorker.sendTask({ type: 'reset', initialTime: 30 });
  }

}
