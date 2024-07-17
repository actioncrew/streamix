# Streamix


  [![build status](https://github.com/actioncrew/streamix/workflows/build/badge.svg)](https://github.com/actioncrew/streamix/workflows/build/badge.svg)
  [![npm version](https://img.shields.io/npm/v/@actioncrew%2Fstreamix.svg?style=flat-square)](https://www.npmjs.com/package/@actioncrew%2Fstreamix)
  [![npm downloads](https://img.shields.io/npm/dm/@actioncrew%2Fstreamix.svg?style=flat-square)](https://www.npmjs.com/package/@actioncrew%2Fstreamix)
  [![min+zipped](https://img.shields.io/bundlephobia/minzip/%40actioncrew%2Fstreamix)](https://img.shields.io/bundlephobia/minzip/%40actioncrew%2Fstreamix)

Streamix is a lightweight and alternative implementation of reactive programming concept. It provides similar interface of RxJS operators, but uses slightly changed concept of streams and emissions. It provides basic functionality for creating, subscribing to, and combining asynchronous data streams. But what is the gain?

Today's developer is a hardened warrior, battling the asynchronous dragons of user interactions, network requests, and the ever-present threat of a lagging UI. Synchronous programming? That quaint notion is about as useful as a dial-up modem in the age of gigabit internet. 

We all know the mantra: "Async/await is the new king!" But let's be honest, sometimes you just need a simple, reliable solution for your own quirky project. You reach for your trusty synchronous code, a comforting blanket in a world of unpredictable promises and callback hell. But alas! It just doesn't quite fit the asynchronous puzzle.

The trend towards asynchronous programming is accepted as Streamix foundation. Let's describe its building blocks shortly:

A Stream is a sequence of values that can be observed. Streams can emit values either synchronously or asynchronously.

An Emission represents a value emitted by a Stream. Emissions can carry additional metadata, such as whether the emission is cancelled or if there was an error.

Operators are components that can be applied to the stream data. They can be used to transform, filter, and combine streams of data.

A Subject is a special type of Stream that allows manually dispatch emissions. Subjects can be used to share a single execution path among multiple subscribers.

Streamix is ideal for those who need a straightforward way to handle asynchronous data without the complexity of more advanced libraries. It is intended as a lightweight alternative to RxJS for simpler use cases.
