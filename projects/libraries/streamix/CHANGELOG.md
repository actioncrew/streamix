# Changelog

## 1.0.12

In version 1.0.12 of Streamix, several key improvements and fixes were implemented to enhance functionality and performance. The library now supports multiple streams as subjects without semaphores, simplifying code structure. Additionally, various onEvent streams were refactored for better organization, and the Angular project was updated. Some method implementations were fixed to ensure proper functionality. A new ollama script was added to generate changelogs within the package, improving documentation. Code cleanup and error handling were enhanced with a check for subject completion before disposing listeners. The HTTP middlewares now use prefixed use- constructs, and unnecessary utility folders were removed for a cleaner setup.

## 1.0.11

The Streamix 1.0.11 release includes several fixes and improvements, such as resolving cached URLs, correcting documentation, implementing certain features like the oauth middleware and retry middleware, optimizing helper scripts, aligning paddings, removing obsolete caching and async folder middleware, and updating the version information.

## 1.0.10

In version 1.0.10 of Streamix, several improvements and bug fixes were implemented to enhance functionality and stability. Key updates include the addition of eventEmitter for better event handling, asyncPipe for more efficient data streaming, and corrections in how promises are awaited during fetch operations. Additionally, the documentation was updated to reflect these changes, ensuring users have accurate information.

## 1.0.9

Added a typing effect for output and several bug fixes, including handling finalizing object URLs, chunk parsing without preliminary JSON conversion, using the same blob across workers, correctly setting worker helpers URLs, adding coroutines support for subfolders, updating configurations, and introducing small fixes to stabilize the release.

## 1.0.8

Streamix 1.0.8 includes several improvements and new features, such as enhanced support for async generators with coroutines, additional functionality for data processing with index parameters, and updates to HTTP client configuration handling xsrf tokens. The release also introduces a new experimental fetch method utilizing web workers, along with various refactorings aimed at cleaning up the codebase and improving performance. Bug fixes address issues like duplicate middleware configurations, incorrect response handling in contexts, and default parameter assignment in HTTP requests. Additionally, there are several feature enhancements including the addition of a travel blog project example, improved documentation, and more comprehensive test cases ensuring stability and reliability.

## 1.0.7

This release includes several key improvements and new features, such as enhanced HTTP handling with support for FormData and URL-encoded requests, improved JSONP streaming with orientation streams and WebSocket support, and various bug fixes and optimizations. New features include the addition of XSRF protection, axios integration, and launch settings configuration. The commitizen script has been updated to streamline testing, and there are several refactorizations to improve code structure and readability.

## 1.0.6

Added a logo and its link, updating the project description to reflect these additions for better branding and user experience.

## 1.0.5+

In version 1.0.5+, Streamix introduced several improvements, including replacing the fetch stream with a new http stream, enhancing support for FormData and url-encoded requests with XSRF protection, adding corrections to various test cases, updating documentation, and removing redundant code while improving efficiency.

## 1.0.4

Fixed a bug that caused incorrect handling of async/await when emitting multiple streams from an async function. Improved code quality and stream operator functionality.

## 1.0.2

Streamix 1.0.2 introduces several enhancements and bug fixes, including improved error handling with a stream-based error call, removal of unused properties for efficiency, and updates to various operators like map and concatMap. The release also adds new features such as the distinctUntilChanged operator and corrections in key areas like fromEvent.ts and configurations. Additionally, performance optimizations include changes to compute and coroutine methods, as well as the addition of new streams and operators, enhancing the library's functionality and stability.

## 0.2.2

Streamix version 0.2.2 introduces several improvements and bug fixes, including a new stream implementation, enhanced emission methods, and refactoring of core functionality to enhance performance and usability.

## 0.2.1

In version 0.2.1 of Streamix, several key improvements and fixes were implemented. The main changes include introducing a new stream implementation with enhanced functionality, adding methods like next and error for better emission control, and updating the specification file to reflect these changes. Additionally, the library's performance was optimized by removing unused properties and hooks, improving efficiency in emission handling without affecting user experience. The introduction of the event emitter API simplifies integration with external systems. Some core functionalities such as failed emissions were deprecated to streamline the API. Furthermore, minor fixes address issues like incorrect timeout behavior and ensure compatibility across different environments.

## 0.1.14

Streamix 0.1.14 introduces several improvements and bug fixes, including enhanced functionality for streams, corrected behavior across multiple modules, performance optimizations, and compatibility updates. Key changes include implementing run and complete methods in the stream component, adding new operators like splitMap and partitionBy, simplifying operations with combineLatest and zip streams, correcting emission-related issues, removing unnecessary code such as non-working tests and unused variables, enhancing documentation, updating dependencies to newer versions, and improving error handling.

## 0.1.11

In this release, Streamix underwent several critical improvements and bug fixes. Key changes include the fix of the delay operator to handle first emissions properly, simplified logic for eachValueFrom, removal of await from finalize.waitForCompletion in run, addition of checks on subscriber numbers before stream completion, modifications in concatMap using microtask queues, updates in fork operator logic, simplification of emissionCounters, reversion of changes related to counting, renaming isStopRequested to isUnsubscribed with a pending flag for streams, removal of unnecessary checks and optimizations, correction of the fromAnimationFrame stream speed, merging pull requests from oleksii-shepel's functional branch, adjustments in mergeMap operators, reverting bus implementation changes, adding timestamps for filtering emissions, inclusion of new streams like fromMutation and fromResize, enhanced documentation, introduction of filter support for single values and arrays, addition of debounce and throttle operators, and correction of the fromAnimationFrame test.

## 0.1.8

In version 0.1.8 of Streamix, several improvements and bug fixes were implemented to enhance performance and streamline reactive programming. Key updates include the introduction of a more efficient queue system for handling events, optimizations in bus emissions to reduce latency, and refined error handling that ensures errors are properly propagated without disrupting the main stream. Additionally, callback management was improved to prevent blocking during event processing, and versioning was updated to 0.1.8.

## 0.1.7

Enhanced Streamix functionality with new features and improvements, including updated core components, additional test cases for stability and edge cases, and restructuring of the event bus implementation.

## 0.1.6

Various improvements and bug fixes including enhanced stream operators, introduction of receiver functionality, and simplification of the API with optional methods.

## 0.1.5

Streamix 0.1.5 introduces several improvements and bug fixes, including renaming key components like 'hook' to 'HookOperator', adding onError functionality, and enhancing operator implementations for better functionality. The version bump reflects these changes with a focus on stability and user experience.

## 0.0.15

Initial version.

## 0.1.1

Initial version of Streamix.

## 0.0.11

Streamix 0.0.11 introduces several improvements, including enhanced performance optimizations and bug fixes, ensuring a more stable and efficient runtime for applications using the lightweight reactive framework.

## 0.0.10

Streamix 0.0.10 includes several key improvements and bug fixes, including an reimplemented streams module with new operators optimized for performance, checks on conditions during emissions to prevent potential infinite loops, the use of initial functions for flattening operators to enhance efficiency, and various corrections to ensure code reliability.

## v0.0.9

In this release, several key improvements were made to enhance Streamix's functionality and performance. The 'chunk extends stream' feature was introduced, allowing for more efficient data processing by extending streams into chunks when appropriate. Additionally, the 'init method to operator' was added, providing a smoother transition between operators. Various minor bugs were fixed, including issues with 'skipChainingOnSubscription', ensuring better reliability and preventing unnecessary operations that could cause performance degradation. The release also includes optimizations in the implementation details for improved efficiency.

## v0.0.8

Streamix v0.0.8 introduces several enhancements, including support for parallel processing and a new chunk class. Subscribers are now represented as hooks with extended functionality, offering improved efficiency and flexibility. The emit method has been updated to streamline operations, while the hook mechanism is modularized into utils with enhanced properties like ownership tracking using weak references. Additionally, various performance optimizations and bug fixes ensure smoother operation.

## v0.0.7

Various improvements and bug fixes were made to Streamix v0.0.7, including the introduction of new hooks like defaultIfEmpty and bufferCount and compute operators. The concatMap, switchMap, mergeMap, and iif streams were optimized with subject switches instead of emitters. The pipe method was corrected, and unused parameters were removed for better efficiency. The emit method was refactored to no longer receive the stream parameter directly, improving encapsulation. Additionally, changes in the algorithm logic enhanced performance and reduced memory usage. The introduction of defer streams provided a new way to handle asynchronous operations within the pipeline. Various test cases were updated or added, ensuring better compatibility and functionality.

## v0.0.6

Streamix v0.0.6 introduces several improvements, including support for race methods to handle cancellation properly and optimized version with lazy loading. Additionally, corrections were made across various components and interfaces, ensuring better functionality and compatibility.

