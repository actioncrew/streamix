# Changelog

## 1.0.12

This release includes several improvements and bug fixes, including refactoring onIntersection for better functionality, updating media query handling, fixing formatting issues, and adding a new ollama script to generate changelog documentation.

## 1.0.11

In version 1.0.11 of Streamix, several improvements and fixes were implemented to enhance performance and stability. Key changes include restoring the authToken middleware after refactoring, correcting documentation for better clarity, adding a retry middleware with proper error handling, updating asyncIterator functionality, optimizing HTTP client operations, resolving URL caching issues, and ensuring data types are correctly handled as Streams. Additionally, various typo corrections and code alignment fixes were addressed to improve overall maintainability and readability.

## 1.0.10

Various improvements and bug fixes in this release, including support for asyncPipe with streamix's async prototype.

## 1.0.9

In release 1.0.9 of Streamix, new features include adding a typing effect for outputs and support for coroutines in subfolders. The project has improved error handling by revoking object URLs during finalization and ensuring that helpers URLs are correctly set. Additionally, there have been several fixes: chunkParser without preliminary JSON parsing is now handled correctly, same blob usage across workers, and minor bugs in the codebase fixed.

## 1.0.8

This release adds several new features like an experimental webWorker fetch and additional sections to the travel blog page, while also improving error handling by allowing response checks after requests. Core improvements include refactoring HTTP options, removing unused middlewares, and enhancing parser functions for better parameter handling.

## 1.0.7

This release includes several updates and features such as refactoring of HTTP methods, improvements to stream handling, additional security enhancements with XSRF protection, and integration with new WebSocket support. Major changes include renaming 'fetch' to 'http', updating the commitizen script, adding axios functionality, and introducing JSONP streaming capabilities. The release also fixed various issues related to error handling and improved documentation.

## 1.0.6

Release 1.0.6 of Streamix includes several key improvements and new features. The logo has been added, enhancing brand recognition. Additionally, a link to the logo's GitHub repository is provided for seamless integration into projects. The description section was also updated to reflect these changes, ensuring clarity on the library's capabilities.

## 1.0.5+

In this release, several improvements and bug fixes were implemented. The httpFetch stream was added to support HTTP requests with data, query parameters, and headers. Additionally, the groupBy functionality was enhanced with new test cases and a more robust implementation. A new webSocket stream was introduced for real-time communication. Various dependency cleanup and internal refactoring were also carried out to improve maintainability and performance.

## 1.0.4

Reactor Streams 1.0.4 is a minor release that includes several bug fixes and cleanup efforts, ensuring improved stability and maintainability. Key updates include restoring the sync version and implementing `catch` as a StreamOperator.

## 1.0.2

This release introduces several improvements and new features to Streamix, including updated stream operators, enhanced error handling, additional utility functions, and optimizations for better performance. New operators like concatMap and bufferCount are added, along with corrections in existing methods such as fromEvent and the debounce function. The package.json and README have been updated for compatibility and documentation.

## 0.2.2

Enhanced functionality and improved stability, including new stream implementations, additional methods for data manipulation, corrections to existing code, optimizations, and enhanced testing support.

## 0.2.1

The Streamix 0.2.1 release introduces several improvements and bug fixes, including a new stream implementation with enhanced functionality for events and operations like concatMap, groupBy, and splitMap. Additionally, there are changes in key methods such as chain, takeUntil, startWith, endWith, and fork. The release also adds corrections to various deprecated functions, removes unused parameters and properties, and refines the event emitter implementation to streamline event handling and improve performance. Furthermore, the release includes updates to the type system, such as removing failed properties from emission and enhancing timerId types, along with new features like the name parameter in createStream. These changes aim to enhance functionality, optimize performance, and provide a cleaner API for developers.

## 0.1.14

The Streamix 0.1.14 release includes several improvements and bug fixes, such as enhanced event handling, introduction of new operators like splitMap and partitionBy, optimizations for performance, cleanup of unused code, and updates to documentation.

## 0.1.11

Various improvements and bug fixes, including enhancing performance and user experience by simplifying stream operations and adding new features like Mutation and Resize streams.

## 0.1.8

This release introduces several improvements to the Streamix reactive stream library, enhancing its functionality and stability. Key updates include the addition of new queue functionality, refining operator behavior for better error handling, and introducing optimizations that reduce latency in event processing. Additionally, multiple pull requests from the community have contributed to bug fixes and functional improvements, ensuring smoother integration with downstream applications.

## 0.1.7

In this release, several key improvements and new features were introduced. The event bus was reimplemented as a generator to enhance performance and scalability. Additionally, support for merging streams using the mergeMap operator was added, with corresponding test cases ensuring robust functionality. Flags now include setter methods, providing better control over stream processing states. Error handling was improved by adding checks for empty input streams, preventing potential runtime errors. The pipeline component underwent significant refactoring, particularly in handling eachValueFrom and the latestFrom operator, which improved efficiency and usability. Finally, various cleanup operations were performed to streamline the codebase and improve maintainability.

## 0.1.6

Changes include updates to various utility functions, introduction of a receiver pattern with enhanced functionality, and corrections to maintain compatibility.

## 0.1.5

Re Streamix 0.1.5, a new version with several important updates and improvements. This release introduced support for event-based streams, enhanced operator functionality, added asynchronous handling capabilities, improved performance, and fixed various bugs. Key changes include the introduction of pipe operators, corrections in stream processing logic, and major refactoring of the stream infrastructure.

## 0.0.15

Initial version.

## 0.1.1

Initial version of Streamix.

## 0.0.11

Initial commit.

## 0.0.10

This release includes several key improvements and fixes. The operators part was removed, which could simplify the usage of the library. An issue with incorrect use of iif was fixed by ensuring conditions are checked on each emission. Additionally, the flattening operators now utilize an init function for better control flow management. Finally, a significant rewrite in streams implementation has been carried out to enhance performance and functionality.

## v0.0.9

Various improvements and bug fixes, including chunk extension, removal of unnecessary methods, operator initialization, corrections to subscription handling, added generic methods, default delayMs parameter, and enhanced documentation.

## v0.0.8

Various improvements and bug fixes were made in v0.0.8, including refactoring the subscriber system to use hooks with new methods, introducing parallel processing capabilities for callbacks, and enhancing the chunk class with a source parameter and improved animations. Additionally, several utility functions were updated, such as adding an initWithHook method and restoring captions.

## v0.0.7

Various improvements and bug fixes were introduced to enhance performance, improve functionality, and ensure compatibility with Streamix's reactive stream processing framework.

## v0.0.6

In version v0.0.6 of Streamix, several improvements and bug fixes were introduced to enhance performance and stability. The library now supports more operators and includes optimizations for better resource management. Additionally, new utility functions and improved testing frameworks were added to simplify usage and ensure reliability.

