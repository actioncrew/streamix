# Changelog

## 1.0.11

In version 1.0.11 of Streamix, several key improvements and fixes were implemented. The oauth middleware was enhanced with proper implementation, corrections to its documentation, and refactorings to improve maintainability. Fixes addressed issues in the helper script cache, request initialization, and caching logic. Additionally, new features like shareReplay were introduced, and various minor bugs were resolved to enhance stability and functionality.

## 1.0.10

In version 1.0.10 of Streamix, several improvements and bug fixes have been made. Key updates include the addition of asyncPipe functionality, enhanced configuration options, and improved error handling. The Promise await support during data fetching has also been stabilized to ensure smoother operation. Additionally, the documentation was updated with a new changelog to reflect these changes.

## 1.0.9

In version 1.0.9, Streamix introduces several enhancements and bug fixes. A new feature adds typing effects for output, improving type safety with static typing support. The prompt functionality has been enhanced by integrating with a local Ollama server using the chunkParser without preliminary JSON parsing. Additionally, a refactored HTTP parser logic was implemented to streamline data handling. Several stability improvements include revoking object URLs upon finalization, utilizing the same blob across all workers for efficiency, ensuring helper URLs are correctly set, and adding support for coroutines in subfolders. These changes collectively enhance performance, reliability, and usability of the framework.

## 1.0.8

In version 1.0.8 of Streamix, several key features and improvements were introduced. The Travel Blog project was added as a new feature. Additionally, refactoring efforts enhanced the HttpFetch API by removing unused callbacks like onProgress and reportProgress from HttpOptions and incorporating readInChunks for better data handling. The HttpConfig now includes xsrfToken as a property, improving security integration. New features such as experimental webWorker support were implemented, along with an updated HTTP client that supports coroutines. The refactoring also included cleanup of unused middlewares and adjustments to the timeout middleware's behavior regarding abort signals. Various fixes addressed issues in parser functions, context handling, and parameter defaults for requests. The Travel Blog page now includes additional sections, and a new resolveUrl method was introduced. The HttpClient was moved to an isolated subpackage for better organization. Finally, several configuration files were updated to reflect these changes.

## 1.0.7

This release introduces several improvements and new features to the stream processing framework, including enhanced HTTP handling with support for FormData and URL-encoded requests, improved JSONP streaming capabilities, additional security features like XSRF protection, and refactoring of core components for better maintainability.

## 1.0.6

This version includes several improvements: a logo was added, an additional link to the logo was provided, and the description was updated.

## 1.0.5+

In this release, several key features and improvements were added to Streamix, including support for HTTP Fetch streams with optional headers, retry functionality with stream reset on retry failure, corrected groupBy implementation across multiple files, updated test cases reflecting these changes, and enhanced package configurations ensuring compatibility.

## 1.0.4

This release adds several fixes and improvements to stabilize the codebase, including enhancing type safety with async checks, updating core logic for proper stream handling, and restoring sync functionality while fixing minor issues.

## 1.0.2

Various improvements and bug fixes including adding new stream operators, enhancing existing functionality, and updating documentation.

## 0.2.2

In version 0.2.2 of Streamix, several improvements and bug fixes were introduced. Key changes include the addition of new methods like next and error, which enhance data processing capabilities. The implementation of createSubscription allows for more flexible subscription management. The stream.spec.ts file was updated to reflect these changes. Additionally, various helper functions such as concatMap, mergeMap, fork, switchMap, takeUntil, startWith, endWith, groupBy, splitMap, withLatestFrom, and timer were reimplemented to improve their functionality and efficiency. Improvements in test cases ensured better code quality. The emit API was refactored by removing failed properties and notifyOnCompletion/notifyOnError from the emission type, simplifying error handling. The eventBus was updated to use stream.next instead of enqueue, improving integration with other components. The implementation of an event emitter replaced eventBus.enqueue, enhancing the library's modularization. Unused hooks were removed, reducing unnecessary code. The emit method now includes a timestamp for better tracking. The version number was incremented to 0.2.2 as part of this release.

## 0.2.1

Streamix 0.2.1 introduces several key improvements, including a new stream implementation with enhanced event handling and emission capabilities. The release features updated methods such as chain, mergeMap, and groupBy, along with corrected implementations of functions like concatMap and fork. New functionalities include the addition of next and error methods, the introduction of createSubscription, and an optimized timerId type. Additionally, the library has streamlined its code by removing unused properties, eliminating redundant hooks, and refactoring the event emitter to rely on a more consistent hook pattern. These changes collectively enhance performance, simplify usage, and improve compatibility with existing setups.

## 0.1.14

The release introduces several new features and refines existing functionalities, including the addition of splitMap and partitionBy operators, corrections to behaviorSubject, updates to stream.ts, and enhanced event handling with a focus on performance and usability.

## 0.1.11

In version 0.1.11, several key improvements were made to Streamix, including fixes to the delay operator and refactoring of stream logic for better concurrency handling. Additionally, deprecated features such as finalizing events and unneeded checks were removed. The bus implementation was simplified, making it more efficient by only suspending the finalize event. New operators like fromAnimationFrame and fromMutation were introduced to enhance animation capabilities, while also adding support for debouncing and throttling operations. Core functions now ensure proper synchronization across all operators, improving overall performance and stability.

## 0.1.8

Various improvements and bug fixes, including new queue functionality, optimized stream operations, and enhanced error handling.

## 0.1.7

Various improvements and bug fixes including corrections to stream.ts, added tests for switchMap, updated hooks, and introduced new functionality such as eachValueFrom with async generators and a generator-based event bus.

## 0.1.6

Reimplement core operators and add receiver functionality, improving consistency and error handling.

## 0.1.5

In version 0.1.5 of Streamix, several significant improvements and bug fixes were implemented to enhance functionality and performance. Key changes include renaming the hook to HookOperator for clarity, adding onError handling capabilities, and correcting numerous logic issues that affected the stability and user experience. New methods such as start() in pipelines were introduced, stream operators like concatMap were reimplemented, and support was extended for both async and sync functions, improving compatibility with modern web applications. Additionally, various performance optimizations, including corrected delays and event bus improvements, were made to ensure smoother operation.

## 0.0.15

Initial version.

## 0.1.1

The initial version was created, introducing the basic functionality and structure of Streamix.

## 0.0.11

This version includes several key improvements and bug fixes, including optimizations for better performance, enhanced user authentication features with rate limiting and secure tokens, and improved logging capabilities for better observability.

## 0.0.10

Re streamix 0.0.10 introduced several key improvements. Operators were removed, enhancing performance and simplifying usage. The iif function was corrected to ensure conditions are checked at emission time. Flattening operators now utilize init functions for better data handling. Additionally, the core streams were reimplemented to provide enhanced functionality and stability.

## v0.0.9

Reactor stream library Streamix version 0.0.9 introduces several improvements and bug fixes. Key changes include removing the 'caller' from stream subscriptions, eliminating the 'shared' feature, and modifying operator methods for better functionality. Additionally, new methods were added to enhance the subscribable interface, default values for delays, and refactoring of chunking operations. The library now handles edge cases more robustly with updated checks on subscription chaining. Finally, version 0.0.9 includes a minor version bump as part of this release.

## v0.0.8

Enhancements and fixes in v0.0.8 include adding a parallel method for concurrent processing, introducing an owner property to hooks as a Map<WeakRef, Set<Function>>, refactoring emit signatures with async parameters, removing stream hooks from various components, implementing chunk-based processing within a chunk's run method, enhancing subscribers' functionality, updating the animation system, and correcting several issues. The hook API has been moved internally and improved with weak references for better memory management. Corrections to test cases ensure reliability, and performance improvements through optimized data structures contribute to faster operations.

## v0.0.7

In version v0.0.7 of Streamix, several improvements and fixes were implemented. Key changes include replacing streams within concatMap, switchMap, mergeMap, and iif with subject instances to enhance efficiency. The emit method was removed from the pipeline and made into a separate component, improving code organization. DefaultIfEmpty was added as a hook for handling empty streams gracefully. Additionally, the init method in hooks now accepts parameters without being called during the stream's lifecycle. The use of next() within subjects in flattening operators simplifies the processing flow. An issue where promises were cached and couldn't be used in loops was resolved by updating promise.race to ensure each iteration gets a fresh promise. BufferCount and compute operators were introduced for more complex data transformations, along with corrections to various methods like cleanup, pipe, and tests related to error handling (Catches), subject lifecycle, and unused parameters. The index.ts file was updated, changes in algorithm logic were implemented, and operator definitions were moved to separate files for better maintainability. Overall, this release improves performance, simplifies the API, and adds new operators while fixing several bugs.

## v0.0.6

This version includes several improvements and bug fixes, such as corrections to operator methods like combineLatest, timer, and interval, adding new features like a fractal example, enhancing the stream handling with callbacks, and improving test coverage. AbstractStream is now instantiable, and there are optimizations for performance. Additionally, new utility functions were introduced, and some redundant code was removed to streamline the library.

