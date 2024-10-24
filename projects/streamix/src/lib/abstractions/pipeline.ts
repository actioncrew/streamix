import { Chunk, createChunk, Emission, Stream } from '../abstractions';
import { hook, HookType } from '../utils';
import { Operator } from '../abstractions';
import { Subscription } from './subscription';
import { Subscribable } from './subscribable'; // Import the Subscribable interface

// This represents the internal structure of a pipeline
export type Pipeline<T> = Subscribable<T> & {
    stream: Stream<T>;
    chunks: Chunk<T>[];
    operators: Operator[];
    currentValue?: T;
    pipe: (...operators: Operator[]) => Pipeline<T>;
    start: () => void;
    complete: () => Promise<void>;
};

// Initialize the pipeline with the initial stream and empty operator list
export function createPipeline<T>(stream: Stream<T>): Pipeline<T> {
    const initialChunk = createChunk(stream);

    // Initial state of the pipeline
    const pipeline: Pipeline<T> = {
        stream,
        chunks: [initialChunk],
        operators: [],
        currentValue: undefined,
        isAutoComplete: false,
        isStopRequested: false,
        isStopped: false,
        isRunning: false,
        subscribers: hook(),
        onStart: hook(),
        onComplete: hook(),
        onStop: hook(),
        onError: hook(),
        onEmission: hook(),

        pipe: function (...operators: Operator[]): Pipeline<T> {
            return bindOperators(this, ...operators);
        },

        subscribe: function (callback?: (value: T) => void): Subscription {
            return subscribe(this, callback);
        },

        start: function (): void {
            this.isRunning = true; // Set running state
            return startPipeline(this);
        },

        complete: async function (): Promise<void> {
            this.isStopped = true; // Set stopped state
            return completePipeline(this);
        },

        shouldComplete: function (): boolean {
            return this.chunks.every(chunk => chunk.shouldComplete());
        },

        awaitCompletion: async function (): Promise<void> {
            for (const chunk of this.chunks) {
                await chunk.awaitCompletion();
            }
        },

        get value() {
          return this.currentValue;
        }
    };

    // Chain hooks to propagate events across chunks
    const chainHooks = (state: Pipeline<T>): void => {
        const firstChunk = state.chunks[0];
        const lastChunk = state.chunks[state.chunks.length - 1];

        firstChunk.onStart.chain((params: any) => state.onStart.parallel(params));
        lastChunk.onEmission.chain((params: any) => state.onEmission.parallel(params));
        lastChunk.onComplete.chain((params: any) => state.onComplete.parallel(params));
        lastChunk.onStop.chain((params: any) => state.onStop.parallel(params));
        lastChunk.onError.chain((params: any) => state.onError.parallel(params));

        lastChunk.subscribers.chain((value: any) => state.subscribers.parallel(value));
    };

    // Function to compose operators and bind them functionally
    const bindOperators = (state: Pipeline<T>, ...operators: Operator[]): Pipeline<T> => {
        // Clear existing operators and chunk subscribers
        state.operators = [];
        state.chunks.forEach(chunk => {
            chunk.subscribers.clear();
        });

        // Create a new array to hold the chunks formed by the operators
        const newChunks: Chunk<T>[] = [];
        let currentChunk = state.chunks[0];

        operators.forEach((operator) => {
            // Clone and initialize the operator
            const clonedOperator = operator.clone();
            clonedOperator.init(currentChunk.stream);

            // Add the operator to the current chunk
            currentChunk.onEmission.chain((emission: Emission) => {
                currentChunk.subscribers.parallel(emission.value); // Propagate emissions
            });

            // Check if the operator contains a stream
            if ('stream' in clonedOperator) {
                // Create a new chunk for the next operator
                currentChunk = createChunk(clonedOperator.stream as any);
                newChunks.push(currentChunk);
            }

            state.operators.push(clonedOperator);
        });

        // Add any remaining operators to the current chunk
        if (currentChunk) {
            newChunks.push(currentChunk);
        }

        return {
            ...state,
            chunks: [...state.chunks, ...newChunks],
        };
    };

    // Function to subscribe to the pipeline
    const subscribe = (state: Pipeline<T>, callback?: (value: T) => void): Subscription => {
        const boundCallback = (value: T) => {
            state.currentValue = value;
            return callback ? Promise.resolve(callback(value)) : Promise.resolve();
        };

        state.subscribers.chain(state, boundCallback);
        startPipeline(state);

        return {
            unsubscribe: async () => {
                state.subscribers.remove(state, boundCallback);

                if (state.subscribers.length === 0) {
                    await completePipeline(state);
                }
            }
        };
    };

    // Start all chunks in the pipeline
    const startPipeline = (state: Pipeline<T>): void => {
        for (let i = state.chunks.length - 1; i >= 0; i--) {
            state.chunks[i].start();
        }
    };

    // Complete all chunks in the pipeline
    const completePipeline = async (state: Pipeline<T>): Promise<void> => {
        for (const chunk of state.chunks) {
            await chunk.complete();
        }
    };

    chainHooks(pipeline); // Initialize hooks after creating the pipeline

    return pipeline;
}
