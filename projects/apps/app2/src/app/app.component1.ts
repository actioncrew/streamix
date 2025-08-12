import { coroutine, CoroutineMessage, seize, SeizedWorker } from '@actioncrew/streamix';
import { Component, OnInit } from '@angular/core';

// --- Worker Function that runs the timer logic ---
// This is a single, stateful function designed to run in a web worker.
// Worker function for use in Coroutine
import { WorkerUtils } from '@actioncrew/streamix';

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
    // This is the direct invocation of createCoroutine.
    const timerTask = coroutine(createTimerWorker);

    // We use the seize operator to get a single dedicated worker from the pool.
    // We now pass callbacks directly to seize for handling messages and errors.
    const timerWorker$ = seize(
      timerTask,
      // onMessage callback
      (msg: CoroutineMessage) => {
        if (msg.type === 'progress') {
          this.timerValue = msg.payload.tick;
          console.log('Counting down...');
        } else if (msg.type === 'response') {
          console.log('Completed');
          this.seizedWorker.release(); // Clean up the worker after it's done
          this.timerStatus = 'Stopped';
        }
      },
      // onError callback
      (error: Error) => {
        console.error('Worker error:', error);
        this.timerStatus = 'Error';
        this.seizedWorker.release();
      }
    );

    // Subscribe to the stream to get the SeizedWorker instance.
    // This is where we get the control object to send tasks to the worker.
    timerWorker$.subscribe((seizedWorker) => {
      this.seizedWorker = seizedWorker;
      this.timerStatus = 'Running';
      console.log('Worker seized, starting timer...');
      // Start the timer for the first time
      this.seizedWorker.sendTask({ initialTime: 60, type: 'start' });
    });
  }

  // Method to reset the timer from the UI
  resetTimer() {
    if (this.seizedWorker) {
      console.log('Resetting...');
      this.timerStatus = 'Resetting';
      // Send a message to the worker to reset the timer to 30 seconds
      this.seizedWorker.sendTask({ type: 'reset', initialTime: 30 });
    }
  }

  // Clean up on component destruction
  ngOnDestroy(): void {
    if (this.seizedWorker) {
      this.seizedWorker.release();
    }
  }
}
