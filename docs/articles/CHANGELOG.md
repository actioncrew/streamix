# Changelog

## 2.0.23

BREAKING: Fixed AsyncIterator protocol compliance across all stream operators: All operators now follow the standard pattern: while (true) → check completion → process → return

## 2.0.22

Retained .map files to improve developer experience.

## 2.0.21

Small fixes, added `forAny` converter, eachValueFrom correctly propagates void values. Updated documentation

## 2.0.20

Introduced detailed documentation for `Coroutines`, explaining how to offload heavy tasks to background threads while keeping apps responsive. Helper functions for asynchronous operations are now included directly in the main package

## 2.0.18

Default Parser Support: `request<T>` now uses `readStatus` as a default parser if none is provided. Reordered parameters in all HTTP methods (`get`, `post`, `put`, `patch`, `delete`): `parser` now comes **after** optional `options`
 
## 2.0.17

You now have a robust, type-safe, and ergonomic reactive streaming library built on modern TypeScript patterns. (Well done!)

## 2.0.16

Comprehensive JSDoc comments were added to all public functions. The codebase now features stronger TypeScript types, leading to better code completion and compile-time error checking.

## 2.0.15

All streams are now **multicast** by default, enabling shared execution and improved performance across multiple subscribers

## 2.0.14

We have added AbortController support to most stream creators to enable proper cancellation and resource cleanup when subscribers unsubscribe. This allows streams to stop producing values promptly, avoid memory leaks, and clean up internal iterators or event listeners automatically.

## 2.0.12

Refactored core operators to use pure AsyncIterator logic without relying on Subject, resulting in cleaner and more predictable behavior. Added the `observeOn` operator for microtask/macrotask scheduling. Renamed the `value` property of Subject to `snappy` to better reflect its intention and humorous design.

## 2.0.11

All built-in operators now fully support asynchronous callbacks. You can provide async functions to operators such as `map`, `filter`, `reduce`, and custom operators without manual workarounds or hacks. Receivers can now be asynchronous. Streamix handles awaiting async callbacks internally, ensuring proper flow control and error propagation.

## 2.0.10

Both `createSubject()` and `createBehaviorSubject()` now expose a synchronously accessible `.value` property that immediately reflects the latest value passed to `.next()`, even before it has propagated to all subscribers.

## 2.0.8

Improved tracking of pending readers to prevent negative counts and ensure buffer slots are released exactly once.

## 2.0.7

The buffer implementation was corrected to ensure proper synchronization between writers and readers, especially in scenarios involving concurrent access and stream completion. Previously, the `readSemaphore` was released for all active readers regardless of whether they were actually pending, leading to incorrect wakeups and race conditions.

## 2.0.6

Due to the asynchronous nature of the internal buffer, `getValue()` is now an async method returning `Promise<T | undefined>`. This ensures consistent and race-free access to the latest buffered value across concurrent consumers.

## 2.0.5

Both Subject and BehaviorSubject now use SingleValueBuffer internally. It offers a more direct and efficient backpressure mechanism for single-value streams (like Subjects and BehaviorSubjects). Unlike CyclicBuffer, it doesn't maintain a history of values beyond the latest one, simplifying the internal logic and potentially reducing memory overhead for these specific use cases. The SingleValueBuffer explicitly provides a value getter, which is a significant departure and a key feature compared to the generic CyclicBuffer. 

## 2.0.1

Fully refactored all built-in operators, replacing complex subscription management with a clean, unified async iterator-based design. Operators now implement the async iterable protocol (`next()`, `return()`, `throw()`) directly, eliminating callback spaghetti and ensuring straightforward, predictable, and maintainable flow control. This approach improves resource management, unsubscription handling, and overall operator performance.

## 1.0.20

Operators in a pipeline were applied left to right — the first operator wrapped the source, followed by the next, and so on. Now operators are applied in reverse order, from right to left — the last operator wraps the source first. Streamix now includes many new built-in operators, enabling richer stream manipulation out of the box. `createMapper` method receives both input and output streams.

## 1.0.18

The `Subscription` type has been enhanced with two new methods: `listen` and `value`. The `listen` method allows for efficient tracking of stream updates. The `value` method gives direct access to the last emitted value, making it easier to retrieve the current state of a stream without additional boilerplate.

## 1.0.16

Streamix now features pull-based subjects, allowing subscribers to independently pull values at their own pace rather than receiving pushed emissions. This ensures that late subscribers can access past values without missing emissions, improving backpressure handling and memory efficiency. Subscriptions are now fully independent, preventing one subscriber’s lifecycle from affecting others. Additionally, pull-based subjects support async iteration (`for await...of`), making them more flexible for asynchronous workflows while enhancing error propagation and buffer management.

## 1.0.14

Various improvements and changes: updated test apps, renamed `StreamOperator` to `StreamMapper`, reorganized package structure, added debug configurations for jasmine scripts, removed emission abstraction, and corrected package metadata.

## 1.0.12

In version 1.0.12 of Streamix, several refactoring efforts were completed to enhance code organization and functionality. The `onIntersection` subscription was reimplemented as a subject, improving event handling efficiency. Additionally, multiple streams were converted into subjects without relying on semaphores, reducing potential synchronization issues. A fix was applied to ensure proper event dispatching from `fromEvent` streams, aligning them with other subscription types. Furthermore, code cleanup measures were taken, including the removal of unnecessary utility folders and dependencies updates. The ollama script was integrated into the changelog generation process, ensuring documentation consistency. Various minor bugs were fixed, such as adding a completion check for subject listeners and correcting event handling implementations. All these changes contribute to a more streamlined and efficient codebase with improved maintainability.

## 1.0.11

In version 1.0.11 of Streamix, several important updates were introduced. The library underwent significant refactoring to streamline its architecture and improve efficiency. A new feature was added, the `oauth` middleware, which simplifies token handling by automating the token flow process. Additionally, various fixes and optimizations were implemented across different components, such as cache management and request initialization, ensuring better performance and reliability. The release also includes minor improvements in documentation and test cases to enhance user experience.

## 1.0.10

In version 1.0.10, Streamix introduced several improvements and bug fixes to enhance its functionality and stability. Key changes include adding support for `eventEmitter`, which allows for more flexible data handling, `asyncPipe` with improved efficiency, and ensuring compatibility with the latest JavaScript standards. Additionally, there were updates to the documentation to reflect these changes.

## 1.0.9

In version 1.0.9 of Streamix, several improvements and bug fixes were implemented to enhance performance and stability. Highlights include adding a typing effect for output, refining HTTP parsing logic with `chunkParser`, implementing changes to the changelog and configurations, introducing coroutines for subfolders, and addressing issues related to object URL management and JSON handling.

## 1.0.8

In version 1.0.8, Streamix introduced several improvements and bug fixes. Key features include the addition of a custom fetch middleware for handling JSON responses efficiently, enhanced documentation with jsdoc comments, and optimization in request processing by setting default params. Additionally, middlewares were made asynchronous, improving performance in asynchronous operations. The Travel Blog project was added as a new feature, along with various other minor enhancements and bug fixes, ensuring the library remains lightweight and efficient.

## 1.0.7

This release includes several important updates and bug fixes, such as introducing a new HTTP client with improved security features, enhancing data fetching capabilities, and making significant improvements to error handling and logging.

## 1.0.6

In version 1.0.6, Streamix underwent several minor updates and improvements. The package gained a logo addition to enhance its branding, an updated description to reflect new features or fixes, and a link added for better documentation access.

## 1.0.5+

New features and improvements including `httpFetch` integration, `groupBy` reimplementation, corrections in `package.json`, and enhanced testing capabilities.

## 1.0.4

This release introduces several improvements to Streamix, including async support through updated coroutine handling, a fallback mechanism for synchronous operations, and minor bug fixes and code cleanup.

## 1.0.2

A lightweight Streamix update introducing new operators and enhancing existing ones, with improved performance and bug fixes.

## 0.2.2

Streamix 0.2.2 introduces several improvements and bug fixes, including a new stream implementation, enhanced method reimplementation for better functionality, additional utility methods like `concatMap` and `splitMap`, corrections to various emission-related functions such as `removeFailed` and `failedRemove`, introduction of the 'name' parameter in `createStream`, improved event handling with an event emitter replacing hooks, optimizations for performance, and compatibility adjustments. The release also includes bug fixes across multiple components, ensuring better stability and functionality.

## 0.2.1

In this version, Streamix introduced a new stream implementation and enhanced its emission capabilities with methods like `next` and `T` to emission. The package also includes optimizations like reducing unused parameters and improved event handling through an event emitter system. Additionally, several helper methods were added such as `concatMap` and `createSubscription`, along with corrections across various functionalities to improve stability and performance.

## 0.1.14

This release, 0.1.14, introduces several improvements and bug fixes to Streamix, including enhanced event handling with a new `BusEvent` type, removal of unnecessary functionality like the 'finalize' event emission, and support for conditional reduction methods. Additionally, dependencies were updated, and some redundant code was removed to streamline the library's architecture. The release also includes minor documentation updates and corrections across various components to improve clarity and functionality.

## 0.1.11

Streamix 0.1.11 introduces several improvements and bug fixes, including simplifying key stream operators like `delay` and `concatMap`, enhancing performance through sync operations, adding new streams such as `fromAnimationFrame`, and correcting issues related to emission counters and subscription handling.

## 0.1.8

Streamix 0.1.8 introduces several key improvements and bug fixes, including enhanced stream handling with non-blocking operators like `withLatestFrom()`, better error propagation by passing errors as events rather than emmissions, removal of unnecessary awaitments for callbacks except finalization, and updates to the version number.

## 0.1.7

Various improvements and bug fixes in Streamix v0.1.7, including updated stream components, added test cases for `mergeMap` and `switchMap`, corrections to code structure, implementation of event bus as a generator, cleanup of unused variables, removal of flags with setters, introduction of `eachValueFrom` method with tests, and updates to the pipeline and operator components.

## 0.1.6

In version 0.1.6 of Streamix, several improvements and bug fixes were implemented across various components including stream and bus operations, compute functions, and receiver integration. Key updates include the introduction of optional methods in receivers, corrections to how streams are merged and computed, enhanced handling of asynchronous operations using awaitables, and the addition of a `clone` method with an initialization step. Additionally, some internal files were reverted due to testing issues, ensuring better compatibility and functionality. The release also includes optimizations for better performance and streamlined API documentation.

## 0.1.5

Streamix 0.1.5 introduces several key improvements and bug fixes, enhancing performance and functionality. The package includes a lighter footprint with reduced dependencies, optimized operators for better handling of async/await tasks, enhanced event handling, and improved integration with JavaScript web workers. Additionally, new features like the `pipe` operator and asynchronous generators are added, along with refactoring of emission logic to improve reliability and user experience.

## 0.0.15

Initial version released.

## 0.1.1

## 0.0.11

Streamix 0.0.11 introduces several improvements, including enhanced stream efficiency with optimized processing algorithms and a new API for better integration with existing applications. Additionally, performance bottlenecks were addressed through refactoring and code optimization techniques.

## 0.0.10

Re Streamix 0.0.10: Implemented streams reimplementing, corrections applied, and operators now use an init function for initialization on stream emission.

## v0.0.9

In version v0.0.9, Streamix introduced several key improvements: support for chunking with a `delayMs` parameter allowing for more flexible data streaming, an operator init method enhancing functionality, and corrections to the subscription methods ensuring proper behavior. The release also eliminated unnecessary methods like 'clone' and 'shared', improving performance by reducing overhead. Chunk creation was optimized based on the outer stream's operations, preventing unnecessary pipelining which enhances efficiency. Additionally, default values for 'delayMs' provide a starting point for developers.

## v0.0.8

Streamix v0.0.8 introduces several improvements, including the introduction of hooks for subscribers, an async processing callback, and the addition of a parallel method to handle concurrency. The `chunk` class was enhanced with a `source` property in its onEmission parameter. The `emit` signature was corrected, and various internal hook methods were updated, such as adding ownership tracking using weak references. Additionally, the binding function always returns a promise, improving reliability. Performance optimizations include removing redundant stream hooks and implementing cleanup methods for define operators.

## v0.0.7

In version v0.0.7 of Streamix, several improvements and bug fixes were implemented. Key changes include introducing new hooks like `defaultIfEmpty`, enhancing operator functionality with `bufferCount` and `compute` operators, refining the logic for subjects to use `next` methods, removing unnecessary code such as stream clone within a pipeline, and fixing issues related to emit methods and parameter usage. Additionally, there are corrections to operator implementations, including simplifying the subject logic, ensuring proper error handling with `catch` operators, and improving test cases for better reliability. The release also addresses performance considerations by moving stream complete into settimeout and optimizing the use of promises.

## v0.0.6

Streamix v0.0.6 introduces several improvements and bug fixes, including enhanced operator support with new methods like `iif`, extended functionality for `fromEvent` streams, and optimized performance. New features such as the `race` method and improved handling of cancellations have been added. The library now supports proxying emission operations through stream sinks and includes additional utility functions. Bug fixes address issues in parallel execution, error handling, and test coverage, ensuring better reliability and compatibility.
