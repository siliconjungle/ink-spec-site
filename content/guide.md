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

## Infer facts and prepare repeated work

Three complementary investigations guide further optimisation: Handwired's compact
exact circuits, Freerange's inferred numeric requirements and Pretext's separation
of measurement from repeated layout. The shared opportunity is to discover useful
facts, prepare stable inputs once and compute only the outputs a caller needs.
These mechanisms can apply to queries, rendering, parsing and numeric computation.

Ink already has staging parameters, checked physical layouts, maintained state
and resident GPU sessions. A new ordinary bit-state library has measured search
gains. Initial checked unsigned-fact inference and numeric-table preparation are
also implemented; broader inference, preparation and projection-sensitive lowering
remain work in progress. Exact effects and observable errors still
constrain which work may be skipped.

Precision is part of the contract. JavaScript text-layout calculations use F64;
rounding their inputs can change a line break. The current CLI now supports F64
across CPU targets, with a prepared simple-walker baseline checked against upstream
geometry. Complete complex text preparation and checked narrower implementations
or guarded fallbacks still need work. Source derivatives remain F32.

Initial Freerange-inspired inference now discovers conditional unsigned
equalities from excluded values and comparisons between ranges. Each proposed
replacement receives an independently checked proof before database publication.
General call summaries, backward requirements and floating-point inference remain
open. [Implementation and measured scope](https://github.com/siliconjungle/ink-lang/blob/452b7f908d51c56bae00ff66986cc98dcc27a80a/docs/conditional-word-facts.md).

[Three-project delivery checklist and acceptance criteria](https://github.com/siliconjungle/ink-lang/blob/66a2c4c6896a5f961e5fa3a3232ad21af8fdedc3/docs/chenglou-optimisation-programme.md#delivery-checklist) · [Measured search scope](./performance.html#matched-handwired-searches)

## Authored code with explicit learning

The current CLI accepts `trainable state`, `adaptive fn` / `adaptive query` and
`learn change`. Ordinary code can use a contextual model, then pass its suggestion
to fixed layout, simulation or generator code. Learning actions update only the
designated trainable state; regular changes cannot write it. Queries stay readonly.
Value state uses ordinary reads and assignments, such as `let w=Model; Model=next;`.

```text
trainable state Model:Weights = initial();
adaptive fn score(context:Context,weights:Weights)->f32 { /* pure model */ }
adaptive query suggest(context:Context)->f32 reads(Model) { /* readonly */ }
learn change observe(context:Context,target:f32,rate:f32)
    ->Result<f32,String> reads(Model) writes(Model) { /* explicit update */ }
```

These signatures illustrate the new forms; the [complete runnable example](https://github.com/siliconjungle/ink-lang/blob/9ee9969bd0d3a1a6ebd00de7317d87b7387e8808/examples/adaptive-layout.ink)
learns width × document-length interactions with an authored squared-error update.
It keeps legal output bounds in fixed code. `ink train SOURCE TRACE.json -o model.snapshot`
can fit before compilation/deployment and exports a portable checkpoint plus a
receipt. Runtime feedback invokes the same explicit learning action. The model
checkpoint loads as data at startup. An explicit restricted build can instead
freeze selected roots and specialize their serving computation, as shown below.

The new CLI is ahead of this page's pinned playground distribution. Automatic
differentiation now propagates through supported pure helpers, structured state
and bounded loops. Authored reverse graphs and neural libraries are also available;
source reverse differentiation now supports dynamic parameter lists and structured
context. Broader source/contract transport, device tape training and automatic
large-graph specialization remain open. The markers grant no approximation or optimisation authority. [Training syntax,
constraints and tested scope](https://github.com/siliconjungle/ink-lang/blob/9ee9969bd0d3a1a6ebd00de7317d87b7387e8808/docs/adaptive-learning.md).

Initial numeric preparation also shares invariant tables inside one invocation.
The large measured case wins substantially; a small case loses. Neither this nor
the learning example establishes broad application speedups. [Preparation evidence](./performance.html#prepared-numeric-tables).

## Learn a program structure

Learning can choose among authored implementations as well as tune numbers.
The current CLI has an example with an expanded bit circuit, a packed word
operation and a trainable representation choice. Its objective is ordinary code:

```ink-cli
fn objective(observation: Metrics, weights: GoalWeights) -> u64 {
    return observation.latency * weights.latency
         + observation.energy * weights.energy
         + observation.memory * weights.memory;
}
```

Another function or learner can change those weights. The example versions each
objective, clears accumulated scores when it changes and rejects stale feedback.
These illustrative observations demonstrate application control; they are not
performance measurements or a general learned-objective compiler planner.

If learning changes the objective itself, an outer authored goal and constraints
govern that change. A lower score under a new objective does not prove improvement
under the old one, and changing priorities grants no new replacement permissions.

After training, explicitly freeze the chosen degree of freedom and request
proof-checked specialization:

```sh
ink build-model adaptive-structure.ink adaptive-structure-training.json \
    --freeze-roots Choice --specialize-frozen \
    --target javascript -o build/structure
ink verify-model build/structure --replay
```

For the packed choice, the serving action becomes `(x & 255) + offset`.
The choice lookup, dispatch and expanded-circuit call disappear; application rows
stay mutable. Complete transition proofs preserve results, errors, events and
checkpoints. Freezing withdraws the choice's writers. Live structural switching,
general graph/tape specialization and physical-layout migration need further
implementation and proofs.

[Complete CLI example](./adaptive-structure.ink) ·
[Training observations](./adaptive-structure-training.json) ·
[Proof domain and limits](https://github.com/siliconjungle/ink-lang/blob/4f1863efdb2b9725291ef5e5aa6449efbc5c70a0/docs/frozen-structural-specialization.md).
This explicit build request does not establish a profitable automatic choice.

## Compile frozen numeric structure

The latest CLI can also specialize frozen F32 coefficients inside records and
authored representation choices. In the complete numeric example, a configured
affine kernel becomes this serving expression:

```ink-cli
((x * 0.5) + 0.25) + Live.get(0).unwrap_or(0.0)
```

The frozen model lookup, kind dispatch and helper call disappear. Live data stays
mutable, and each F32 operation keeps its original order and rounding. Signed
zero, subnormals and exact NaN payloads remain supported; floating comparisons
stay ordinary IEEE operations. Freezing withdraws the model's writer and binds
its exact rows into the checkpoint namespace.

```sh
ink build-model frozen-numeric-structure.ink frozen-numeric-structure-training.json \
    --freeze-roots Model --specialize-frozen \
    --target javascript -o build/numeric
ink verify-model build/numeric --replay
```

The supplied trace configures the model explicitly; a learner can produce that
same typed state. Every proposed computation must pass complete transition-proof
replay against the restricted source. This is ahead of the pinned browser
build and adds no new syntax, general graph unrolling, device training or automatic
profitability decision. The retained checks include built-package execution,
rollback, exact snapshots and a separate numeric GPU control, without a new speed
claim. A broader audit still has historical column-layout fixture failures.

[Complete CLI example](https://github.com/siliconjungle/ink-lang/blob/4755313b185f070111f40c372fec565f10595a2b/examples/frozen-numeric-structure.ink) ·
[Configuration trace](https://github.com/siliconjungle/ink-lang/blob/4755313b185f070111f40c372fec565f10595a2b/examples/frozen-numeric-structure-training.json) ·
[Proofs, execution checks and limits](https://github.com/siliconjungle/ink-lang/blob/4755313b185f070111f40c372fec565f10595a2b/reports/frozen-numeric-structure-2026-10-16/README.md).

## Learn instruction sequences

A whole-computation objective can train discrete instruction choices as well as
numeric parameters. The [learned-program example](./learned-program.ink) searches
all 256 four-instruction motifs, repeated into a 32-operation program. Its loss
evaluates the complete candidate on authored input/target pairs and includes an
explicit instruction-count preference. That preference is not measured latency.

The application controls the legal coefficients, random inputs, optimizer,
accepted candidates and target versions. It can train offline, resume its complete
Adam state or invoke the same learning action during runtime. A retargeting action
can reset the other learner's optimizer. Errors roll back the complete update.

```ink-cli
// After importing std:learning and declaring the example's types:
trainable state Structure:Table<u64,List<Op>>=Table.empty();
trainable state Weights:Table<u64,Coefficients>=Table.empty();
trainable state Policy:Table<u64,learning.Adam>=Table.empty();
trainable state Target:Table<u64,Goal>=Table.empty();
```

Use the complete downloadable source and [recorded training inputs](./learned-program-training.json)
with the current CLI:

```sh
ink build-model learned-program.ink learned-program-training.json \
  --freeze-roots Structure --specialize-frozen --target javascript \
  -o build/learned-program
ink verify-model build/learned-program --replay
```

Freezing the exact instruction rows withdraws their writers. Checked specialization
then preserves runtime weights, goal changes, errors and events, including loss
calculations over changing workload data. This finite authored grammar does not
imply arbitrary application-to-network conversion, device training, convergence
or automatic profitable planner selection.

The compiler can now turn computations determined entirely by the frozen structure
into exact constants, including this example's instruction counter. Runtime inputs,
weights and target workloads stay live. Every proposed numerical result and complete
action rewrite still passes the ordinary checker. Trained artifacts also retain one
checked proof package, with a bound local reference in the generated descriptor.

[Scoring API, proof boundary and runnable examples](https://github.com/siliconjungle/ink-lang/blob/67aa3a2ec42149c400ee52d5e1d7ed8b8384a317/docs/learned-programs.md).

## Check whole neural computations

The current CLI can export a complete mathematical model of the staged neural
example: 244 parameters, six actions, mutable optimizer/control state and frozen
architecture. Typed shared definitions preserve branch exits, caller captures,
ordered events and rollback while keeping larger computations within the proof
transport limits.

This gives proof authors a complete graph to work with. Faster executable graphs,
learned representations and profitable device choices still need their own proofs
and measurements. The change passed 480 core tests across all 80 integration
targets; three retained source-bound compiled artifacts also replay with it.

[Whole neural computation model and limits](https://github.com/siliconjungle/ink-lang/blob/1f5e4e2d1e9582254ce9791e5257094dfd27af69/docs/modular-action-projection.md) ·
[Complete model and validation report](https://github.com/siliconjungle/ink-lang/blob/1f5e4e2d1e9582254ce9791e5257094dfd27af69/reports/modular-action-projection-2026-10-17/README.md).
This describes the current CLI; the embedded browser editor retains its separately
pinned distribution.

## Compile smaller working state

The current CLI can propose a smaller working representation while a model's
weights keep changing. If a fold carries node values and a running total, but
only the node values affect its result, a checked alternative can carry just the
values. It removes the unused field's record storage and arithmetic at each step.

This requires a proof for every possible step and state. A training trace or a
field-liveness guess cannot authorize the change. The source function is rewritten
once, so its ordinary and transactional callers share the smaller implementation;
events, rollback and portable checkpoints retain their contracts.

This is an ordinary source/proof transformation using the existing syntax, with
no special neural instruction. Automatic selection still requires performance
evidence. The embedded browser editor retains its separately pinned distribution.

[Source example, proof contract and limits](https://github.com/siliconjungle/ink-lang/blob/b5f6d9373ab5518ca26c2788b338057c115763e6/docs/fold-state-projection.md) ·
[Measurements and complete validation](./performance.html#owned-graph-state-projection).

## Compile structure, keep learning weights

Program structure and numeric parameters can have separate degrees of freedom.
The current CLI can freeze an operation sequence while leaving its weights
trainable. In the eight-operation example, the serving action loses its list
traversal, helper call and opcode dispatch. Each request still reads fresh weights
and live application data; learning actions can keep updating those weights.

```sh
ink build-model examples/frozen-program.ink examples/frozen-program-training.json \
    --freeze-roots Structure --specialize-frozen \
    --target javascript -o build/frozen-program
ink verify-model build/frozen-program --replay
```

Freezing withdraws the structure writer. Ordinary complete action proofs must
validate the specialization; dynamic ReLU decisions, F32 order, failed updates,
events and portable checkpoints retain their meaning. The supplied trace explicitly
configures the sequence. It does not demonstrate fitting that sequence.

The final JavaScript serving path measured 1.57× faster in six paired processes,
or 1.13× with a weight update every request. The proof-bearing package is larger,
and general neural graphs, long generated computations and learned physical/device
choices remain further work. This is explicit CLI specialization; the pinned
browser editor remains on its separately documented distribution.

Shared mathematical data and reusable closed lemmas now remove proof bottlenecks
for larger frozen models. Complete finite and exceptional F32 lists specialize
through 512 values. A runnable 244-value example freezes its model while a
separate trainable cell stays live. Ordinary proofs bind every raw bit, including
NaN payloads and signed zero. Browser replays check complete results, events and
checkpoints, and reject altered frozen payloads without changing live state;
a separate pure control actually runs on WebGPU. General graph/tape compilation,
long generated computations and learned device choices remain open. This is a
verification-capacity improvement, with no new serving-speed measurement.

[Run the configured model](https://github.com/siliconjungle/ink-lang/blob/5fe4eb6a962b0ff7d4a9e8734796a612ca17e4b4/examples/frozen-parameters.ink) ·
[Factored proofs and build commands](https://github.com/siliconjungle/ink-lang/blob/5fe4eb6a962b0ff7d4a9e8734796a612ca17e4b4/docs/factored-literal-proofs.md) ·
[Retained source checks, package costs and browser replays](https://github.com/siliconjungle/ink-lang/blob/5fe4eb6a962b0ff7d4a9e8734796a612ca17e4b4/reports/factored-literal-proofs-2026-10-16/README.md).

[Complete operation-sequence example](https://github.com/siliconjungle/ink-lang/blob/10704024e2491ac421902853ab5cd43e14d9aa9a/examples/frozen-program.ink) ·
[Measurements, costs and source checks](./performance.html#frozen-program-with-live-weights) ·
[Proof domain and remaining limits](https://github.com/siliconjungle/ink-lang/blob/10704024e2491ac421902853ab5cd43e14d9aa9a/docs/frozen-structural-specialization.md#compile-a-frozen-program-while-weights-remain-trainable).

### Longer frozen programs

Explicit specialization now compiles 32-, 128- and 512-operation programs while their
weights and live application state keep updating. Typed helpers share repeated
code in a balanced call graph, and ordinary proofs check every complete action. Browser histories also
reject altered frozen code without changing live state.

The repeated 32/128-operation examples now use 3/5 helper definitions rather than
7/31. Six paired Node processes per size measure about 1.46×/1.52× faster warm
serving than the unspecialized baseline, or 1.19×/1.34× with weight updates every
request. At 128 operations, generated JavaScript is 23% smaller than the earlier
expanded layout. Startup improves against that layout but still trails baseline.
Expanded code remains an explicit checked proposal option.
`build-model --specialize-frozen` now packages that checked plan with the trained
initial state. Artifact verification replays every helper extension and complete
action proof, including when training replay is disabled. JavaScript, native,
Rust, Wasm and WebGPU-host artifacts retain live learning capabilities; browser
CPU fallback binaries are included in composed WebGPU packages. A 64-operation
pure model prefix also passes actual GPU calls for eleven raw F32 input/weight
classes. Pure 32/128/512-operation model roots now also run on the actual GPU:
eligible scalar statements share one ordered stage, with exact arithmetic and
no budget increase. Complete stateful serving and training remain CPU work.
Broader capture shapes, query/state fusion, general graph/tape compilation and
device training remain work.

Universal prefix proofs now share the same helper equation across remaining
tails, while separate witnesses bind the exact frozen code. The 128-operation
plan shrinks from 3.29 MB to 836 KB, and the previously rejected 512-operation
case now checks under the existing budgets. Its initialized package passes
465 browser comparisons, including eleven complete-model GPU cases, live
updates and exact checkpoints; stateful serving/training remain CPU work. This improves proof/build scalability. The
32/128-operation runtime code and its serving measurements are unchanged.
The opcode sequence in these examples is configured explicitly, not learned.

The 64-operation GPU helper now uses one stage instead of 64. Six paired browser
processes measure 1.84× faster complete GPU calls. Single scalar requests still
strongly favor CPU/JavaScript; batching and residency need their own measurements.
No automatic profitable placement follows from GPU eligibility.
[Device checks, timings and clean-source shader images](https://github.com/siliconjungle/ink-lang/blob/43648be78625e60b1dc3022f74b551aabc6cd556/reports/scalar-gpu-stages-2026-10-16/README.md).

[Compile the longer program](https://github.com/siliconjungle/ink-lang/blob/43648be78625e60b1dc3022f74b551aabc6cd556/docs/frozen-composition.md) ·
[Measurements and startup costs](./performance.html#longer-frozen-programs) ·
[Exact prefix proofs, source checks and browser histories](https://github.com/siliconjungle/ink-lang/blob/fc714b545d1fc56896d397d96dc8b20095278ddb/reports/parametric-prefix-proofs-2026-10-16/README.md).

## Give the planner an authored goal

The CLI and adaptive host can now rank already checked compiled variants using
an ordinary Ink function. It sees the whole eligible portfolio and an explicit
typed context, which can include learned parameters and application state.
The objective can be nonlinear and can change through an application-controlled
learner. Performance remains the default policy; the language has no built-in
engagement target.

For example, the same program can prefer latency now and a smaller representation
later. Publishing a new captured objective serializes with application calls,
rejects stale updates and restarts selection confirmations. Correctness proofs,
resource limits, migration checks and switch budgets still apply. Each application
action runs once.

The current goal can itself be a controlled degree of freedom. An authored
controller can learn how to prioritize memory, latency or application-defined
utility as context changes, then publish a fresh goal revision. The application
still defines which updates are permitted and how their outcomes are judged.
Changing the scoring rule alone does not establish improvement; feedback and
comparisons need their goal identities.

This is opt-in portfolio ranking for offline and runtime planning. General compiler
search does not yet learn its objective automatically, and a model's score is not a
certified prediction. Binary64 goal code uses CPU fallback on GPU hosts.

[Complete source example](./programmable-objective.ink) ·
[Host APIs, offline command and limits](https://github.com/siliconjungle/ink-lang/blob/509441c691e83e6f607c87049f01d883f0cc0996/docs/programmable-objectives.md).
This feature is available through the current CLI, ahead of the embedded playground.

## Guide compiler search with a learned policy

An Ink model can now order the compiled planner's search frontier using the
complete checked program structure and captured typed context. A flat node-and-edge
document exposes source, representation, fact and routing information without
deep recursive transport. Exact numeric tokens stay exact.

The complete CLI example includes an authored model, trainable Adam state and
explicit feedback. Publishing its context for a new compilation can change which
intermediate structures are explored. A test reaches a useful rewrite within the
same proof budget after training; its labels are synthetic, so this demonstrates
programmable exploration rather than measured search quality or speed.

Every proposed edge still needs proof replay. Runtime measurements and final
deployment selection keep their existing gates. A failed or timed-out model falls
back to ordinary frontier ordering. Inner semantic search, recipe scheduling and
broader learned optimization remain further work.

[Complete CLI policy and training example](./search-policy.ink) ·
[Initial example context](./search-context.json) ·
[Options, replay, budgets and validation](https://github.com/siliconjungle/ink-lang/blob/4b2dfe79b7e14c01f94765a47394bfc22d47c734/docs/learned-search.md).
This CLI feature is ahead of the embedded playground.

## Train through authored computation

An application-wide objective can use the complete explicit context and evaluate
the final result of supported computation. Ink can differentiate through that
pure computation, or use authored rewards to learn from outcomes of a
nondifferentiable environment. It does not automatically differentiate an
arbitrary running application across transactions, database operations, I/O and
GPU execution. Relevant state enters through explicit arguments; the author
chooses which parameters may change and which constraints must hold. Forward full
gradients support up to 32 F32 coordinates. Source reverse differentiation supports
larger dynamic F32 parameter lists, and explicit reverse graphs remain available. [Current interfaces and scope](https://github.com/siliconjungle/ink-lang/blob/a9d33ae9f72e9af0679eff782fc5922e381b852f/docs/differentiable-computation.md).

A trainable field identifies what learning may change. The objective can run that
model through authored simulation, layout or generation code and measure the final
outcome. Ink now generates gradients through the admitted pure computation:

```text
let derivatives = gradient(objective, parameters, context);
let sensitivity = jvp(objective, parameters, direction, context);
```

For larger parameter shapes, the current CLI can record one bounded forward tape
and traverse it backward:

```ink-cli
let derivatives = reverse_gradient(objective, parameters, 4096, true, context)?;
```

The objective can call ordinary helpers, zip/map lists, use optional/result context
and run bounded loops. `4096` limits tape nodes; `true` explicitly skips zero
cotangents. The result preserves the parameter shape or returns an error.
`reverse_linearize` also returns the primal value. A 64-parameter learner matches
results, events and exact checkpoints across compiled targets and browser hosts;
its tape runs on the CPU. This is a capability check, with measured speed and device
training still to do. [Complete CLI example](./source-reverse-learning.ink) ·
[Interfaces, ownership and assurance scope](https://github.com/siliconjungle/ink-lang/blob/411cd0a456d9d267058b30cbf0ff95700ee401d6/docs/source-reverse-differentiation.md).

The [world/controller example](https://github.com/siliconjungle/ink-lang/blob/15d360d477158a0da314776279724018f759c928/examples/differentiable-world.ink)
propagates gradients through twelve feedback-controlled physics steps. Two training
contexts improve from loss 1 to about .039 after 200 updates; a held-out context
improves from .378 to .015. These are designed capability checks, not a claim of
arbitrary-task generalization. A batched trajectory-gradient computation also has
confirmed execution on the GPU. Learning actions themselves execute on the host.

This extends Ink's existing degrees of freedom. `trainable state` and `learn change`
limit mutable parameters; `requires` / `ensures` enforce legal updates and rollback;
`gradient_piecewise` explicitly chooses an executed-branch derivative convention.
Existing specifications and approximation bounds still govern permitted replacement
behaviour. Training observations grant no optimization proof authority.

Supported arithmetic keeps its authored forward path; generated F32 derivative
formulas describe a real arithmetic lift, not derivatives of IEEE rounding. Hard
collisions, discrete switches and singularities need explicit policies and can
still give unhelpful gradients. [Interfaces, contracts and limits](https://github.com/siliconjungle/ink-lang/blob/d8005a095fe0e560b51df127610991b0980b89e4/docs/differentiable-computation.md).

Full gradients now carry all basis directions through one primal execution.
Each tangent lane keeps its scalar operation order. Generic JavaScript local
scalar-record storage and native F32 carrier bookkeeping reduce temporary work
without changing arithmetic. The large held-out polynomial gradient improves
2.09×; an authored derivative remains about 9× faster. Two source-bound database
equations compare batched and separate directions on specific nonlinear kernels.
They strengthen concrete checks without proving the whole AD transform or backend. [Performance controls](./performance.html#automatic-derivatives-and-prepared-context).

Unsigned inference now also crosses bounded helper-call graphs. Two new database
laws replay exact definition contexts and bit-vector proofs; changed callees
invalidate their summaries. [Source-bound call facts](https://github.com/siliconjungle/ink-lang/blob/15d360d477158a0da314776279724018f759c928/docs/interprocedural-word-facts.md).

## Reuse prepared computation

A `keep` can describe a derived structure as well as a scalar. The current CLI
retains immutable records, lists, strings and recursive values on JavaScript,
Rust and Rust/Wasm hosts. Checked state dependencies determine invalidation:

```ink
module prepared_points;
record Point { x:f32, y:f32, }
state Points:Table<u32,Point>=Table.empty();
keep Powers:List<f32>=Points.values().map(fn(p)=>p.x*p.x+p.y*p.y);
query total()->f32 reads(Powers){return sum(Powers);}
change put(key:u32,point:Point)->Result<Unit,String> writes(Points){
    Points.put(key,point);return Ok(());
}
```

`Powers` is computed on its first observation and reused until `Points` changes.
An unrelated state write preserves it. Public results are detached; rollback and
restore preserve source behavior. Derived caches are excluded from portable
checkpoints. Owned Buffer/Map descendants remain ineligible.

The prepared neural example uses the same mechanism to retain an architecture
while weights, Adam moments and training controls change. It preserves the
original learning results and full logical state. Held-out JavaScript prediction
calls improve about 3.45× on one host. Cold setup, memory and frequent invalidation
can lose; the measured training-only workload regresses about 24%. An explicit
keep does not guarantee a profitable lifecycle. Automatic cost-aware staging,
graph specialization and GPU training remain open. The pinned playground can
compile the syntax above but predates this structured retention implementation.

[Mechanism and ownership](https://github.com/siliconjungle/ink-lang/blob/fcbdfefe18f7d2fef11ceb50798d824a428ba805/docs/structured-preparation.md) · [Runnable neural example](https://github.com/siliconjungle/ink-lang/blob/fcbdfefe18f7d2fef11ceb50798d824a428ba805/examples/prepared-neural.ink) · [Gains and regressions](./performance.html#structured-preparation-lifecycle).

The current CLI also accepts an explicitly kept default for a mutable value cell.
For example, `keep Seed:List<u32>=[2,3];` can initialize
`trainable state Model:List<u32>=Seed;`. Its transitive dependencies must contain
no state or action access. The live cell remains mutable; the prepared default
stays private, with ordinary rollback and recovery. This avoids rebuilding an
unused default optimizer on every model read. No new keyword is needed.

The complete staged neural example improves held-out JavaScript prediction from
11.12 to 9.38 µs in its matched study, a further 1.19× beyond structured keeps.
Cold prediction and observed heap use increase. Each source retains its own
checkpoint identity, while complete trained logical state and call results agree.
The pinned playground predates this initializer extension; these are current CLI
capabilities. Explicit freezing is additionally checked through compiled startup,
inference, writer withdrawal and restore.

[Default preparation and ownership](https://github.com/siliconjungle/ink-lang/blob/f1f1f57ea1307226b1731fa8cbb208e9b925c86a/docs/prepared-initializers.md) · [Complete staged model](https://github.com/siliconjungle/ink-lang/blob/f1f1f57ea1307226b1731fa8cbb208e9b925c86a/examples/staged-neural.ink) · [Retained lifecycle evidence](https://github.com/siliconjungle/ink-lang/blob/f1f1f57ea1307226b1731fa8cbb208e9b925c86a/reports/prepared-initializers-2026-10-16/README.md).

## Prepare a model and learn through it

The CLI now includes ordinary `std:autodiff`, `std:neural` and `std:learning`
libraries. A ReGLU network can be prepared once, then evaluated and differentiated
with changing weights and complete explicit context:

```text
let model = nn.network(10, [6,6], 4, 10000)?;
let update = nn.mse_gradient(model, weights, context, target)?;
```

The complete example learns 244 parameters, with all derivatives checked against
an independent dense-network oracle. Preparation keeps the selected graph roots;
fused affine/ReGLU nodes express the authored arithmetic. It fits Ink's broader
stack compression goal: model preparation, numeric computation, state updates and
recovery share the language's types and transaction boundaries. Graph execution
and optimizer updates currently run on CPU hosts.

Learning state includes Adam's two moments, step count and learning-rate control.
A rejected candidate frame restores moments with weights. An outer action failure
rolls back all state and events. `ink train ... --restore prior.snapshot` continues
from the exact complete state. Hard-step estimators, indexed backward differences
and stopping at zero cotangents are explicit policies; none supplies an
approximation or convergence proof. The F32 optimizer differs from Handwired's
binary64 moment arithmetic.

This delivers a prepared graph interface, not automatic reverse differentiation
of every source program. [Interfaces, runnable example and assurance scope](https://github.com/siliconjungle/ink-lang/blob/e47ad29de8ea2161d984e78e80a3aeaa1a054c28/docs/reverse-learning.md)
· [Matched performance and remaining gaps](./performance.html#prepared-reverse-models).
The pinned playground remains behind these new CLI libraries.

The current JavaScript host can also prepare a pure call across helper boundaries.
`prepareCompiled('predict', [[0, graphHandle]])` binds an immutable captured graph;
changing weight/context handles still compute fresh predictions and gradients.
The first valid-shape invocation validates topology, and successful stable checks
can then persist within that token. Forged graph records keep their errors. Public
results detach, and thrown failures retry. No new Ink keyword is needed.

This applies preparation to the full helper computation, with a bounded private
call graph, rather than requiring an application to flatten its source. It is an
explicit pure-call capability; stateful learning actions do not silently adopt it.
[Source and boundaries](https://github.com/siliconjungle/ink-lang/blob/3855acdb81c2575c4ffa9c36983359b2cd7f590b/docs/prepared-helpers.md) · [Runnable pure model](https://github.com/siliconjungle/ink-lang/blob/3855acdb81c2575c4ffa9c36983359b2cd7f590b/examples/prepared-network.ink) · [Measured gains and costs](./performance.html#pure-helper-preparation).

Programmers control training through ordinary logic. A checked two-learner example
uses one model's loss to choose another model's rate, invokes its training action,
and supports explicit pause and step budgets. Nested actions share rollback of
models, configuration and events. Pure policies compute decisions; declared
learning actions apply them. These controls should compose across phases.
[Runnable orchestration example](https://github.com/siliconjungle/ink-lang/blob/e47ad29de8ea2161d984e78e80a3aeaa1a054c28/examples/learning-orchestration.ink).

Training must span the lifecycle: fitting before compilation, an explicit training
stage during builds, adaptation on runtime feedback, and continuous learning while
serving. The current CLI supplies offline replay and explicit online updates.
A model/observation-generic session now adds bounded feedback, serving/candidate
separation, work budgets, publication cadence and stale-version rejection. The
compiled JavaScript/Wasm service serves predictions between cooperative training turns
and durably recovers queued/candidate progress, including an offline CLI bootstrap.
An explicit build stage packages that complete state for adaptive deployment, or
explicitly freezes selected roots and withdraws their writers. Automatic arithmetic/graph
specialization, trained implementation selection, parallel worker promotion
and device training remain open. These phases share the full objective and optimizer lineage.
[Lifecycle contract and implementation status](https://github.com/siliconjungle/ink-lang/blob/dc56b528f244b6ce9bf2010592293bc66203319a/docs/learning-lifecycle.md).

```sh
ink build-model examples/adaptive-layout.ink examples/adaptive-layout-training.json \
    --target javascript -o build/fitted-layout
ink verify-model build/fitted-layout --replay
```

The build captures the checked source and explicit trace, executes authored learning
actions, then compiles a startup factory from the complete fitted checkpoint. Targets
include JavaScript, native, Rust projects, Wasm and mixed GPU modules. Runtime learning
stays enabled; existing durable stores retain their newer state. Verification binds
the package's inputs and files, with optional reference training replay. It establishes
neither artifact authenticity nor compiler correctness.
[Build-stage training, startup interfaces and limits](https://github.com/siliconjungle/ink-lang/blob/dc56b528f244b6ce9bf2010592293bc66203319a/docs/trained-builds.md).

Freeze only when the application wants to remove those degrees of freedom:

```sh
ink build-model examples/adaptive-layout.ink examples/adaptive-layout-training.json \
    --freeze --target javascript -o build/frozen-layout
# Or freeze named roots while retaining other learners:
ink build-model SOURCE TRACE.json --freeze-roots First,Prepared \
    --target wasm32 -o build/partly-frozen
```

The frozen source binds exact typed rows and withdraws their writers and callers.
Other application and learning state can remain mutable. Restore rejects any change
to the fixed rows, and artifact verification replays the full restriction even if
someone recomputes file hashes. The complete optimizer/control state, pending events
and commit version survive under a new source identity. These bindings expose
constant facts to the proof system; they do not yet establish faster neural inference.
[Immutable state, proof scope and limits](https://github.com/siliconjungle/ink-lang/blob/dc56b528f244b6ce9bf2010592293bc66203319a/docs/frozen-state.md).

A continuous learner remains ordinary source logic. The application can pause a
session, change its budget or cadence, advance a candidate, publish it, cancel it
without dropping observations, or explicitly discard bad feedback. Candidate
promotion checks its source model version and ticket before replacing the serving
model. Tests compare 39 lifecycle cases across targets and four compiled durable
histories against exact reference checkpoints, including storage failures before
and after publication. This is a cooperative CPU-host service; one synchronous
work turn still blocks its event loop until it returns.
[Runnable service, contracts and limitations](https://github.com/siliconjungle/ink-lang/blob/e021405ecddec2bf604907b3d1a709cffb6b3658/docs/continuous-learning.md).

The application author owns the goal, reward, relevant context, permitted changes
and invariants. Ink has no built-in engagement or other product objective.
Differentiable objectives use source gradients or prepared reverse graphs;
`std:policy_gradient` adds categorical choice scores, allowed-choice masks,
reward-to-go and trajectory gradients for authored discrete policies. Random
inputs and feedback are explicit. The runnable example uses source AD and full
Adam state, retains pending delayed feedback, checks policy versions and supports
transactional rollback. Its two designed training contexts reach about 98.7%
preferred-action probability; this establishes neither generalization nor a runtime
speedup. Sampling and score arithmetic have explicit F32 limits; policy training
runs on CPU hosts.
[Authored rewards, contracts and evidence](https://github.com/siliconjungle/ink-lang/blob/d6f209ab822814c4c95bd410b86fd1809abe9914/docs/policy-learning.md).

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

## Binary64 across compiled boundaries

The current CLI supports explicit `f64` computation, ordinary/trainable state,
events, keeps and portable checkpoints across Rust, JavaScript and Rust-Wasm.
This preserves JavaScript measurement precision instead of silently narrowing
text-layout inputs to F32.

```text
module precise_measurement;
fn scale(width:f64,ratio:f64)->f64 {
    return width*ratio;
}
fn measured()->f64 {
    return 1.0000000000000002f64;
}
```

Unsuffixed decimal literals retain their F32 meaning. Cross-width conversions
are explicit. Scalar equality follows IEEE rules; stored structural equality and
snapshots preserve raw float bits. Exact nonfinite values can cross JSON through
`{"F64Bits":"unsigned decimal u64"}` tags. The same typed value can pass between
compiled language/runtime boundaries without a separate lower-precision model.

Binary64 functions retain CPU execution in mixed GPU bundles. F64 proof terms
currently fail closed, and source AD/neural/Adam libraries remain F32. This is
precision groundwork for Pretext, not complete text preparation/shaping, GPU
binary64, automatic application-wide differentiation or a speedup claim. This
CLI feature is ahead of the browser editor's separately pinned compiler.

[Syntax, semantics and limits](https://github.com/siliconjungle/ink-lang/blob/a9d33ae9f72e9af0679eff782fc5922e381b852f/docs/binary64.md) · [Retained sources and validation](https://github.com/siliconjungle/ink-lang/blob/a9d33ae9f72e9af0679eff782fc5922e381b852f/reports/binary64-2026-10-16/README.md).

## What runs today

The CLI also exposes `std:prepared_text`: ordinary Ink algorithms for Pretext's
simple prepared line walkers. Immutable measured facts are separate from changing
widths. Count/height requests avoid line strings and ranges; full geometry returns
exact binary64 widths and segment/grapheme cursors. This initial domain matches
232 pinned upstream oracle cases and a 182-observation compiled history with
resizes, edits, cursor continuation, rollback and restore. The simple module
rejects complex break kinds. Font measurement, segmentation and
upstream speed parity remain open; the first diagnostic still shows a substantial
gap to Pretext's direct loop. This CLI library is ahead of the browser compiler.
[Interfaces, evidence and scope](https://github.com/siliconjungle/ink-lang/blob/eb1d3f0a45886d999171f49ff0c4e88203a87f59/docs/prepared-text.md).

The current CLI also adds `std:prepared_complex_text` for soft hyphens, tabs,
preserved spaces, objects, unbroken boundaries and rich-inline geometry. Explicit
numerical engine profiles remain separate from measured text facts. Its
upstream-only oracle supplies complete geometry and continuation cursors; state
histories check edits, resizes, failed updates, events and recovery across compiled
targets. Text geometry stays on CPU hosts, with a separate numeric device control.
This extends fidelity; the substantial speed gap to Pretext still needs work.
[Complex CLI source example](./prepared-complex-text.ink) ·
[Data, profiles, budgets and validation](https://github.com/siliconjungle/ink-lang/blob/74eac1d6ae41674be4b590f8beeadfac4c65421b/docs/prepared-text.md).
The embedded browser compiler predates this module.

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


## Prepare work inside loops

The current CLI can carry immutable captured inputs through sequential JavaScript
callbacks. An ordinary helper can build an index or coefficient table once, then
use it for changing queries, loop elements and indices. The source still describes
the complete computation; the explicit prepared-call interface binds its fixed
inputs. No new source keyword is required.

```text
module batch;
fn member(keys:List<u32>,query:u32)->Bool {
    let index:Map<u32,Bool>=foldr(keys,Map.empty(),fn(k)=>fn(m)=>m.set(k,true));
    return index.contains(query);
}
fn batch(keys:List<u32>,queries:List<u32>)->List<Bool> {
    return queries.map(fn(query)=>member(keys,query));
}
```

After compiling this complete module with the current CLI, bind its keys:

```javascript
const entry = model.compiledValues.batch;
const keys = entry.params[0].capture([1, 2, 3]);
const prepared = model.prepareCompiled('batch', [[0, keys]]);
const queries = entry.params[1].capture([7, 2, 9]);
const answer = entry.result.materialize(model.callPreparedCompiled(prepared, [queries]));
```

The index is created lazily at the first reached helper and reused by that token.
An empty query list needs no index; changing the keys requires a new capture and
token. Iteration inputs stay dynamic, results stay detached, and owned/parallel
callbacks retain ordinary execution. Stateful learning does not automatically
adopt this pure-call capability. This CLI feature is ahead of the pinned browser
playground.

Fixed data can also travel in the same immutable record as changing queries,
weights or inputs. Bounded field tracking through constructors and helper returns
preserves that distinction, so a readonly index or coefficient table can persist.
Unused dynamic arguments, fields and guards still execute in source order;
iteration inputs and new model primals stay live. The
[matched record study](https://github.com/siliconjungle/ink-lang/blob/509441c691e83e6f607c87049f01d883f0cc0996/reports/prepared-fields-2026-10-16/README.md)
retains complete results, setup, memory and VM warm-up sensitivity. Its gains over
the prior emitter do not close the substantial Pretext performance gap.

The same mechanism applies to queries, layout helpers and model code, but its
benefit depends on reusable work. The retained study has large repeated-index
wins alongside small-case losses and extra retained memory; neural and text
controls still expose substantial gaps.
[Execution contract and runnable source](https://github.com/siliconjungle/ink-lang/blob/509441c691e83e6f607c87049f01d883f0cc0996/docs/prepared-loop-callbacks.md) ·
[Measured gains and remaining gaps](./performance.html#sequential-callback-preparation).

## Prepare through optional and result branches

The current CLI also carries captured immutable data through `Option.fold`,
`Option.map`, `Result.fold`, `Result.map` and `Result.map_err` callbacks. A changing
optional query can reuse an index built from fixed keys:

```text
module optional_index;
fn member(keys:List<u32>,query:u32)->Bool {
    let index:Map<u32,Bool>=foldr(keys,Map.empty(),fn(k)=>fn(m)=>m.set(k,true));
    return index.contains(query);
}
fn selected(keys:List<u32>,query:Option<u32>)->Bool {
    return query.fold(fn(q)=>member(keys,q),fn(unit)=>false);
}
```

Using the prepared-call interface above to bind `keys`, `None` builds no index;
the first reached `Some` builds it, and later queries reuse it. Capturing a complete
immutable `Some` or `Ok` value also fixes its payload. An uncaptured sum keeps its
payload changing. This lets a fixed model structure remain reusable through
fallible helpers while weights and inputs still require fresh computation.

The receiver runs once, unvisited arms remain lazy, thrown failures retry, and
owned values retain ordinary execution and loan checks. Bounded work analysis can
skip optional preparation; it grants no proof or measured profitability. This
pure-call CLI capability is ahead of the pinned playground. The matched study
retains both large repeated-work gains and a 3–4% complex-text regression; deeper
representation and helper optimization remain open.

[Execution contract and captured-payload example](https://github.com/siliconjungle/ink-lang/blob/97131de5a7c57319976e8c2e5fab79ef102cbb3e/docs/prepared-sum-callbacks.md) ·
[Measurements and validation](./performance.html#optional-and-result-callback-preparation).

## Keep record fields local through helpers

The latest CLI can keep immutable record fields in local variables through
JavaScript value loops and bounded pure helpers. Conditional results inside an
expanded helper can merge their fields directly. The source keeps its ordinary
record interface:

```text
module points;
record Pair { x:u32,y:u32, }
fn advance(p:Pair)->Pair {return Pair{x:p.y,y:p.x+1};}
fn run(n:u32)->Pair {
    let initial=Pair{x:1,y:2};
    return repeat_until(n,initial,fn(p)=>false,fn(i)=>fn(p)=>advance(p));
}
```

Whole-value uses reconstruct the ordinary record. Fields and arguments still
execute in order, branches stay lazy, and owned values retain their storage and
loan rules. This also supports binary64 and immutable composite fields, with
ordinary calls as the fallback when expansion is too large. It supplies no new
syntax, proof or profitable-selection authority and is ahead of the pinned
browser build.

The retained text study has large-case gains alongside substantial small-call
losses. That record/helper change leaves the neural module byte-identical. The
later F32 carrier work below improves derivative execution; deeper model
representation and graph/tape specialization remain open.
[Execution contract](https://github.com/siliconjungle/ink-lang/blob/809cd0323b33265035d388a42b40f2335ec43600/docs/local-record-helpers.md) ·
[Gains, losses and controls](./performance.html#local-record-and-helper-execution).

## Normalize F32 values once

The latest CLI JavaScript emitter tracks values already in Ink's internal F32
representation: rounded binary32 Numbers or exact NaN tags. Scalar parameters,
immutable aliases and scalar loop slots with normalized writes can avoid repeated
carrier conversion. Arithmetic still rounds in its original order. Borrowed host
fields retain every typed read, getter and error position; mutable values retain
their snapshots.

This requires no new syntax. It improves complete derivative evaluation in the
matched neural workload, while prediction remains mixed. Binary64 text modules
are unchanged. The capability is ahead of the pinned playground, and supplies no
graph rewrite or automatic profitable-selection authority.

[Execution contract](https://github.com/siliconjungle/ink-lang/blob/48ab606425d7c38d131bdd656ce4f231a724f4fd/docs/normalized-f32-carriers.md) ·
[Neural results and controls](./performance.html#normalized-f32-neural-execution).
