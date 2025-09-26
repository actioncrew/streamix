/**
 * A collection of helper functions, designed to provide consistent behavior
 * across different JavaScript environments.
 */

// --------------------------- Property Definitions ---------------------------

/**
 * Defines a single property on an object. This is a shim for `Object.defineProperty`.
 */
var __defProp = Object.defineProperty;

/**
 * Defines multiple properties on an object. This is a shim for `Object.defineProperties`.
 */
 var __defProps = Object.defineProperties;

/**
 * Gets all own property descriptors of an object. This is a shim for `Object.getOwnPropertyDescriptors`.
 */
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;

/**
 * Gets all own property symbols of an object. This is a shim for `Object.getOwnPropertySymbols`.
 */
var __getOwnPropSymbols = Object.getOwnPropertySymbols;

/**
 * Checks if an object has an own property. This is a shim for `Object.prototype.hasOwnProperty`.
 */
var __hasOwnProp = Object.prototype.hasOwnProperty;

/**
 * Checks if a property is enumerable. This is a shim for `Object.prototype.propertyIsEnumerable`.
 */
var __propIsEnum = Object.prototype.propertyIsEnumerable;

/**
 * Gets a well-known symbol or creates a new one.
 */
var __knownSymbol = (name, symbol) => (symbol = Symbol[name]) ? symbol : Symbol.for("Symbol." + name);

/**
 * A helper to define a property. It's more robust than direct assignment.
 * If the key already exists on the object, it uses `__defProp` to ensure
 * the property is enumerable, configurable, and writable. Otherwise, it
 * just assigns the value directly.
 */
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, {
    enumerable: true,
    configurable: true,
    writable: true,
    value
}) : obj[key] = value;

// ----------------------------- Object Spreading -----------------------------

/**
 * Implements object spreading (`...`). It copies all own properties (both
 * string keys and symbols) from `b` to `a`.
 */
var __spreadValues = (a, b) => {
    for (var prop in b ||= {})
        if (__hasOwnProp.call(b, prop))
            __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
        for (var prop of __getOwnPropSymbols(b)) {
            if (__propIsEnum.call(b, prop))
                __defNormalProp(a, prop, b[prop]);
        }
    return a;
};

/**
 * Spreads property descriptors. It combines the property descriptors of
 * object `b` with object `a`.
 */
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

// --------------------------- Asynchronous Operations ---------------------------

/**
 * A helper function for transpiling async functions (`async function`).
 * It wraps a generator function in a Promise to manage the asynchronous
 * flow using `next`, `throw`, and `return`.
 */
var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
        var fulfilled = (value) => {
            try {
                step(generator.next(value));
            } catch (e) {
                reject(e);
            }
        };
        var rejected = (value) => {
            try {
                step(generator.throw(value));
            } catch (e) {
                reject(e);
            }
        };
        var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
        step((generator = generator.apply(__this, __arguments)).next());
    });
};

/**
 * A marker object used internally by `__asyncGenerator` to identify
 * when a Promise needs to be awaited.
 */
var __await = function(promise, isYieldStar) {
    this[0] = promise;
    this[1] = isYieldStar;
};

/**
 * A helper function for transpiling async generator functions (`async function*`).
 * It handles the complex logic of yielding values and awaiting promises
 * within an asynchronous loop, providing an async iterator.
 */
var __asyncGenerator = (__this, __arguments, generator) => {
    var resume = (k, v, yes, no) => {
        try {
            var x = generator[k](v),
                isAwait = (v = x.value) instanceof __await,
                done = x.done;
            Promise.resolve(isAwait ? v[0] : v).then((y) => isAwait ? resume(k === "return" ? k : "next", v[1] ? {
                done: y.done,
                value: y.value
            } : y, yes, no) : yes({
                value: y,
                done
            })).catch((e) => resume("throw", e, yes, no));
        } catch (e) {
            no(e);
        }
    };
    var method = (k) => it[k] = (x) => new Promise((yes, no) => resume(k, x, yes, no)),
        it = {};
    return generator = generator.apply(__this, __arguments),
        it[__knownSymbol("asyncIterator")] = () => it,
        method("next"),
        method("throw"),
        method("return"),
        it;
};

/**
 * A helper function for the `for await...of` loop. It retrieves the
 * appropriate iterator from the object and wraps it in a way that
 * can be consumed asynchronously.
 */
var __forAwait = (obj, it, method) => (it = obj[__knownSymbol("asyncIterator")]) ? it.call(obj) : (obj = obj[__knownSymbol("iterator")](),
    it = {},
    method = (key, fn) => (fn = obj[key]) && (it[key] = (arg) => new Promise((yes, no, done) => (arg = fn.call(obj, arg),
        done = arg.done,
        Promise.resolve(arg.value).then((value) => yes({
            value,
            done
        }), no)))),
    method("next"),
    method("return"),
    it);
