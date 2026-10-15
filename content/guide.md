## A small example

A table, a derived total and an atomic update:

```ink
module prices;

state Prices: Table<u64, u64> = Table.empty();
keep total_price: u64 = sum(Prices.values());

change set_price(item: u64, price: u64)
    -> Result<Unit, String> writes(Prices)
{
    Prices.put(item, price);
    return Ok(());
}

query total() -> u64 reads(total_price) {
    return total_price;
}
```

`keep` defines a relationship: the total must agree with the table. `change` declares which state it can update and commits atomically. `put` inserts or replaces a row.

Set prices to 40 and 60: the total is 100. Change 40 to 45: it becomes 105. The JavaScript backend can retain an unchanged scalar total; a relevant write may require a scan. A separately proved implementation could maintain it with `100 - 40 + 45`. Measurements decide whether that extra maintenance pays for itself.

[Run this example in the editor](./environment/?example=prices) · [Download this program](./prices.ink)

## Bring it into your app

Compile to a JavaScript module:

```sh
ink build prices.ink --target javascript -o prices.mjs
```

```js
import { createState } from './prices.mjs';

const prices = createState();
const setPrice = prices.bind('set_price');
const total = prices.bind('total', { resultOnly: true });

setPrice(1n, 40n);
setPrice(2n, 60n);
console.log(total()); // 100n
setPrice(1n, 45n);
console.log(total()); // 105n
```

Your app supplies inputs and reads results. Ink owns typed state and its computation. Typed bound calls resolve an entry once; scalar arguments must use the correct carrier, including BigInt for `u64`. Ordinary `invoke(name, args)` remains available with its checked input and full result envelope. Returning only a result still preserves rollback, versions and committed events.

## JavaScript values, without JSON

JSON text is optional. A declared Ink record accepts a matching JavaScript object; lists use arrays, strings and booleans use their usual JavaScript values, and `u64` uses BigInt. Supported typed arrays can also supply list inputs. These values can be called directly or encoded as binary without `JSON.stringify` or `JSON.parse`.

```ink
module profiles;

record Profile { name: String, scores: List<u32>, visits: u64, }
fn identity(profile: Profile) -> Profile { return profile; }
```

```js
import {functions, valueCodecs, callOwned, callBinary} from './profiles.mjs';

const profile = {name: 'Ada', scores: [3, 5], visits: 2n};
const borrowed = functions.identity(profile); // may share the input object
const checked = valueCodecs.identity.arguments.capture({profile});
const owned = callOwned('identity', [checked.profile]); // detached result

// Binary transport accepts the same typed JavaScript data directly.
const request = valueCodecs.identity.arguments.encode({profile});
const reply = callBinary('identity', request);
const received = valueCodecs.identity.result.decode(reply);
```

Direct pure functions trust stable, correctly typed inputs; they do not validate arbitrary external data. `capture` validates and owns an external logical value, and binary calls validate their byte input. `callOwned` detaches the result but does not add input validation by itself.

This is typed data interchange, not serialization of arbitrary JavaScript objects. Functions, symbols, `undefined`, cyclic graphs and class behavior have no general wire representation. Prototypes, methods and shared-object identity are not preserved; `Date`, `Map` and `Set` need an explicit representation in supported Ink types.

## JSON across boundaries

JSON can enter Ink, become a compiled value, change, and travel as binary bytes. A server can validate and forward those bytes; conversion back to JSON is needed only at a consumer that wants JSON.

```ink
module documents;
import "std:json" as json;

fn mark_received(document: json.Json) -> Result<json.Json, json.JsonError> {
    return json.set(document, "received", json.boolean(true));
}
fn identity(document: json.Json) -> json.Json { return document; }
```

`Json` is an ordinary recursive datatype from the pinned knowledge library. It supports arbitrary nested objects and arrays, exact numeric tokens, missing-versus-null lookup, updates and projection. JavaScript apps can supply plain objects through the explicit `fromJS` boundary and get plain objects back with `toJS`. No JSON text round trip or record declaration for each object shape is needed:

```js
import {JsonCodec, valueCodecs, callOwned} from './documents.mjs';

const documents = new JsonCodec(valueCodecs.identity.result);
const input = {title: 'hello', unknown: {items: [true, null, 3]}};
const result = callOwned('mark_received', [documents.fromJS(input)]);
if (Object.hasOwn(result, 'Ok')) console.log(documents.toJS(result.Ok));
// {received: true, title: 'hello', unknown: {items: [true, null, 3]}}
```

These adapters run only when a JavaScript host calls them. Native Rust and Rust/Wasm execution, source types and wire formats are unchanged; existing calls acquire no implicit conversion. Containers are detached. Cycles, getters, undefined, functions, class instances and sparse arrays reject rather than being silently coerced. Inputs must be stable plain data; Proxy traps are not sandboxed.

Finite Numbers and BigInts can enter this boundary. On return, the default Number policy rejects overflow or decimal precision loss. Use `toJS(value, {numbers: 'bigint'})` for exact integers, or `{numbers: 'string'}` to retain every numeric token as a string. JSON has no separate BigInt tag, and ordinary JavaScript objects need not preserve JSON member order or number spelling. The [complete boundary contract](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/json-and-portable-values.md#plain-objects-at-the-javascript-boundary) covers accepted properties and resource limits.

Text remains a separate entry point when the input really is JSON. `JsonCodec.parse` preserves exact numeric tokens; schema codecs also convert JSON into typed records and collections, rejecting invalid shapes and out-of-range numbers.

```js
import {JsonCodec, valueCodecs, callBinary} from './documents.mjs';

const documents = new JsonCodec(valueCodecs.identity.result);
const document = documents.parse('{"title":"hello","unknown":1e10000}');
const request = valueCodecs.mark_received.arguments.encode({document});
// An external network layer can carry request and reply unchanged.
const reply = callBinary('mark_received', request);
const result = valueCodecs.mark_received.result.decode(reply);
console.log(documents.stringify(result.Ok));
```

In a JavaScript process, opaque handles can keep values in the selected compiled
representation between calls. Parse directly into a handle, run the compiled
function, and render the reply when text is needed:

```js
import {JsonCodec, valueCodecs, compiledValues, callCompiled} from './documents.mjs';

const documents = new JsonCodec(valueCodecs.identity.result);
const input = documents.parseCompiled(
  compiledValues.mark_received.params[0], '{"title":"hello","unknown":1e10000}');
const reply = callCompiled('mark_received', [input]);
console.log(documents.stringifyCompiled(
  compiledValues.mark_received.result, reply, {unwrapResult: true}));
```

The renderer preserves exact numeric tokens and member order, rejects an Err
reply, and checks JSON validity and resource limits. Encode a handle with its
compiled codec for network transport; receiving peers decode through their own
codec. A JavaScript handle belongs to its module and cannot itself cross the
network. These explicit APIs avoid intermediate logical trees, but their complete
lifecycle costs still need measurement for the application.

The portable binary format binds a declared schema and validates lengths, types and resource bounds. JavaScript binds validation and visitation operations to the immutable schema once, while retaining complete checks. Compiler-derived codecs can then materialize validated bytes with literal typed readers; runtime-defined schemas keep the generic decoder. Rust also offers borrowed validation without constructing a document tree. Networking stays outside Ink. Compiled calls currently materialize target values, and Wasm boundaries copy buffers; this is not a zero-copy or speedup claim. Dynamic JSON runs on CPU hosts.

JavaScript `callOwned` returns a detached logical result for callers using the same stable, well-typed inputs as a plain pure call. `ValueCodec.capture` validates and owns external logical values in one pass; `ValueCodec.copy` requires already valid values. Resource bounds apply to copying, and ordinary pure calls keep their existing sharing contract.

JavaScript also supplies `valueCodec.compact()` and `callCompact`. This optional transport omits the per-message schema hash and node frame lengths when both peers have already agreed on the exact schema identity and format. Type, Unicode, count and resource checks remain. Portable messages and state checkpoints retain their existing formats. The demo lets you try both transports.

`JsonCodec.parseCompact` and `TypedJsonCodec.parseCompact` can emit agreed-schema
bytes directly from JSON tokens, avoiding a temporary logical tree. The complete
compact schema validator checks the result. This is an explicit construction
alternative: paired tests improve the 512-field numeric fixture by about 18%,
while small and Unicode fixtures regress. Choose the boundary using comparable
workload measurements.

```js
import {JsonCodec, valueCodecs, callCompact} from './documents.mjs';
const documents = new JsonCodec(valueCodecs.identity.result);
const document = documents.parseCompact('{"title":"hello"}');
const requests = valueCodecs.mark_received.arguments.compact();
const request = requests.encodeWith(w => w.frame(() => w.bytes(document.subarray(1))));
// Both peers negotiate the exact schema identity and transport format first.
const reply = callCompact('mark_received', request);
```

[Try the compiled JSON flow](./json.html) · [Download the source](./documents.ink) · [JSON and portable value contracts](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/json-and-portable-values.md)

## Teach Ink a better way

Algorithms, storage layouts and transformation laws live in a separate knowledge database. Ink checks a proposed optimisation's proofs against the actual program. Measurements choose among valid alternatives.

Knowledge can remove intermediate collections, maintain derived results, introduce indexes, select layouts or reuse immutable values. It can also supply a new typed helper algorithm that was absent from the source: for example, replace a filtered list followed by a count with a proved ordered counting loop. The helper passes ordinary type, ownership and termination checks, and an equality proof must justify its use.

A new optimisation can improve the same source when rebuilt. The compiler supplies general checking and execution machinery; the database accumulates reusable ways to use it.

[How database-authored algorithms work](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/database-executable-extensions.md)

## Plan before the application runs

Search can compose a query rewrite, maintained representation, physical layout and execution route, revisiting layers while there is useful work and budget. Every step has its own checked obligations. The emitted application executes the selected plan without carrying a proof search engine.

With an installed knowledge checkout:

```sh
ink compile prices.ink --optimise knowledge --target rust \
  --search-budget 16384 --state-limit 4096 --planning-seconds 3600 -o prices.rs
ink compile prices.ink --plan prices.rs.planning.json --target rust -o replayed.rs
```

The first command records the selected chain and search receipt. Frozen replay checks the proof packet without rediscovering it. More search can find better alternatives; it does not guarantee a global optimum. Ordinary selection retains the baseline without comparable lifecycle evidence. An explicitly supplied experimental work model can predict pure-call gains, subject to its separate guards.

[Search, planning and physical strategies](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/database-planning.md)

## Learn from real usage

Optional recording captures call frequencies, input shapes, concurrency and lifecycle phases without storing input values. Publish those immutable observations, then compile again: planning discovers compatible recordings and uses measured complete-session costs across the observed cohorts. You do not have to invent query/update weights.

Proofs establish correctness. Profiles guide profitability. A past observation cannot establish a type invariant or predict every future request. Compiled resource plans can choose capacity reservations, checked final-use releases and admission credits. Runtime credit checks still handle future overload, rejecting with `INK_BACKPRESSURE` while preserving accepted-call order.

[Observed usage, proved properties and resources](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/proved-usage-planning.md)

## Split the work across targets

Eligible pure pipelines can combine **JavaScript, WebAssembly and WebGPU**. Saved target-bound cost profiles account for startup, data transfers and repeated use. Consecutive GPU stages can keep intermediates on the device. Stateful transactions execute on the host.

[Try a three-stage pipeline in the editor](./environment/): compile and choose JavaScript or eligible WebGPU execution. The editor exports Rust source; Rust/Wasm builds and adaptive profiles use the native Ink toolchain. The checker runs in Wasm, while browser execution uses fixed target selection. Run does not perform profitability experiments.

[How placement works](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/adaptive-execution.md)

## One computation across the stack

Application logic often fetches data, decodes it, transforms it, aggregates it and then sends part of it to another execution system. Each hand-off can force a materialized collection, a copy or a separate optimisation decision. Ink's direction is to describe the connected computation with shared types and meaning, so a planner can consider those decisions together.

An ordered query is an ordinary expression, and its consumer remains ordinary code:

```ink
module queries;

fn selected(xs: List<u32>, minimum: u32) -> List<u32> {
    return list<u32>{
        from x in xs;
        where x >= minimum;
        select x * 3;
    };
}

fn total(xs: List<u32>, minimum: u32) -> u32 {
    return sum(selected(xs, minimum));
}

fn overlap(xs: List<u32>, ys: List<u32>) -> Bool {
    return exists{from x in xs; join y in ys on x == y;};
}
```

`list<T>` preserves source order and every duplicate. `exists` searches for a witness without constructing matching pairs. First inputs and independent join inputs evaluate once in written order; additional `from` clauses are lateral. Existing word arithmetic still wraps. These forms elaborate to normal checked list operations rather than granting an optimisation exemption.

Seeing the query together with its consumer creates opportunities to fuse transformations, skip unnecessary construction, push predicates and projections toward data, reuse an index, or maintain only the changes to an aggregate. Database laws must establish each transformation; target eligibility and complete lifecycle costs decide whether an admitted implementation is useful.

| Boundary | Direction and current scope |
| --- | --- |
| Ordinary code and queries | Typed ordered queries work inside functions and supported actions; broader relational operators and unordered carriers remain in progress |
| Updates and derived results | Existing keeps and checked maintained representations share transaction semantics with application code |
| JavaScript, Wasm and GPU | Eligible pure computations and pipelines can use different targets; transactions stay on the host |
| Memory and persistent storage | Chunked/out-of-core execution, external database pushdown and an Ink-native storage engine are future work |
| Logical values and transport | Existing compiled-value and binary interfaces can avoid some repeated conversion; each boundary retains its own validation and ownership contract |

This is the stack-compression ambition: fewer independently designed execution layers and more decisions made over one connected program. It does not require every stage to run on one machine or one device. A future plan might filter at storage, transfer only surviving columns, reduce on the GPU and return a small result. The storage backend, effect model and evidence for such a plan still need implementation.

Queries must not acquire permission to change ordering, float behavior, errors, events or transaction visibility merely because another placement is faster. A GPU scan also pays for upload, dispatch and readback; an indexed CPU lookup can be cheaper. Keeping intermediates resident can change that balance. Passing a device conformance test establishes tested agreement, while profitability needs separate measurements.

[Try the query example](./environment/?example=queries) · [Exact query contract](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/query-expressions.md) · [Implementation programme](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/optimisation-language-programme.md)

## See what growing knowledge changes

Two different improvements matter: finding a better algorithm and executing the chosen algorithm with less overhead. Ink measures them separately.

![Execution gains and regressions as reusable proof families grow](./proof-growth.svg)

With the compiler fixed, the 16-family proof-growth study reports 2.17× on designed JavaScript inputs and 2.39× on its actual AST/mesh cohorts. The fused GPU alternative regresses on average. A separate ten-program study combines compiler improvements and measured planning for a 1.73× geometric-mean gain over the previous default; selection alone contributes 1.29× against the updated compiler's baseline.

These are specific workload results. JSON encoding has improved, while decoding, state updates, text conversion and memory still show important gaps against the Frontier controls. The experimental work model has selected only one program in its held-out validation.

[Read the results, controls and remaining gaps](./performance.html)

Private datatype layouts are being evaluated separately from compiled execution.
Prepared-value probes reduce wrapper allocations and test guarded native-object
sequences, compact scalar tags and templates learned from usage. These probes
are not selected compiler implementations and do not establish an overall speed
win. An explicit shared Boolean-circuit mode now reduces proof-generation cost;
48 bounded tagged-word equations replay through the normal checker. Existing
certificates retain their original circuit mode and bytes.

[Versioned circuit scope, evidence and limits](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/shared-bit-circuits.md)

## What runs today

Ink supports typed state, atomic changes, ordered events, scalar retention, generics, owned buffers, pure computation and source specifications with proved implementations and invariants. Targets include Rust, JavaScript and Rust/Wasm, plus eligible GPU work. Database knowledge supplies source algorithms, maintained queries, indexed/grouped representations and physical strategies under their individual admission contracts.

| Use | Current boundary |
| --- | --- |
| Embed typed state and derived results in an application | Compiled calls, atomic changes, rollback, ordered events and explicit checkpoints |
| Compile collection and numerical computation | CPU execution across supported lowerers; a narrower pure subset can run on the GPU |
| Explore proved alternatives to an algorithm or representation | Bounded offline search, checked evidence and separate profitability decisions |
| Experiment in the browser | Single-file compilation, execution and explicit local target profiling |

Ink remains a working prototype. Broad performance on unfamiliar applications, automatic live strategy switching and schema evolution are open work. The checker, codecs, lowerers and host toolchains are trusted implementations; accepted rewrite proofs do not establish end-to-end compiler correctness.

The standalone [editor repository](https://github.com/siliconjungle/ink-environment) contains the real browser compiler and execution environment. It supports single-file programs and explicit local target profiling. Linked imports, automatic external knowledge search and native Rust execution are outside that editor's current scope. Its exact compiler and package versions are linked below; language support, proof coverage and target eligibility remain distinct.

[Language reference](./reference.html) · [Implementation status](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/STATUS.md) · [Benchmark evidence](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/BENCHMARKS.md)

## Open source

Ink's compiler, optimisation knowledge, planner, lowerers, runtime, ABI, native support, editor, documentation site and Lean exporter are MIT licensed. Bundled dependencies, fonts and research data retain their own licences and notices.

[MIT license](./ink-license.txt) · [Language repository](https://github.com/siliconjungle/ink-lang) · [Editor repository](https://github.com/siliconjungle/ink-environment) · [Design and ambitions](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/vision.md)

## Keep values in compiled storage

A compiled JavaScript module exposes typed opaque values. Capture a logical input once or decode an agreed-schema binary value, call functions with the handle, and encode the result directly for transport. The handle owns its private data and rejects foreign or mismatched types. Public materialization returns detached mutable containers.

The module can retain checked type facts with its private immutable handles. This allows repeated calls to avoid equivalent type-only guards; semantic `requires` clauses remain active. These facts do not prove arbitrary JSON number grammar or unique object members. The JSON boundary keeps those validations.

For repeated Unicode rendering, an optional `createJsonQuoter()` from the same generated module can be passed as `{quoter}` to `JsonCodec.stringifyCompiled`. It reuses escaped strings and exact UTF-8 lengths while charging output budgets on every call. It adds retained memory and can slow cold or short sessions; choose it using comparable lifecycle measurements. `clear()` releases its entries. Binary transport and ordinary calls do not require this option.

```javascript
import {compiledValues, callCompiled, JsonCodec, valueCodecs} from './documents.mjs';
const json = new JsonCodec(valueCodecs.identity.result);
const input = compiledValues.mark_received.params[0];
const document = input.decodeCompact(json.parseCompact(text));
const result = callCompiled('mark_received', [document]);
const bytes = compiledValues.mark_received.result.encodeCompact(result);
const logical = compiledValues.mark_received.result.materialize(result);
```

Capture and decoding costs belong in the workload profile. Private outputs, detached public outputs and encoded outputs have different costs. State actions retain their separate capture and transaction APIs.

The JavaScript planner can also propose private layouts that flatten nested sums.
Knowledge supplies ordinary proofs in both directions; core checks the exact
source codecs, and the backend preserves logical values, validation limits,
ownership and checkpoint bytes. These layouts apply to general immutable values,
including recursive trees and exact numbers. They require comparable lifecycle
evidence for selection. See the [layout contract](https://github.com/siliconjungle/ink-lang/blob/9ebcf86315ce882aae4f3d48019d5e42dca97931/docs/private-sum-layouts.md).

### Checked reader alternatives

Opaque-value codecs expose decodeFused and decodeCompactFused alternatives that
validate while constructing private values. They preserve typed transport
constraints, owned results and validation diagnostics. Their profitability
depends on the complete workload; decoding alone can improve while edit and
encoding become slower.

A checked physical plan can select these readers for a source function and
transport format. The optimisation database proposes the choices, and automatic
planning compares logical, portable and compact call lifecycles. Runtime
execution follows the selected plan. The general synthetic profile is a starting
model; observed usage profiles take precedence.

[Measured trade-offs](./performance.html#checked-wire-readers-and-automatic-boundary-planning) · [Physical plan contract](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/checked-physical-capabilities.md)
