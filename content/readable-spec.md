## 1 How it works

Ink compiles state and computation together. You define the data, the changes it permits and the results you need. The compiler checks the program, checks any proposed optimisation evidence, and emits an implementation for the selected target.

This page describes the published implementation linked in the footer. Wider proposals are in the separate design draft. Execution support and proof-based replacement support have different limits.

| Part | Responsibility |
| --- | --- |
| [Semantic core](https://github.com/siliconjungle/ink-lang/tree/{{ink_revision}}/core) | Types, fixed semantics, reference execution and general evidence checking |
| [Knowledge](https://github.com/siliconjungle/ink-knowledge) | Immutable definitions, laws, proofs, snapshots and separate performance observations |
| [Planner](https://github.com/siliconjungle/ink-planner) | Bounded search, applicability evidence and cost selection |
| [Runtime](https://github.com/siliconjungle/ink-runtime) | Artifact assembly, scheduling, saved-profile selection, host adapters and fallback |
| [ABI](https://github.com/siliconjungle/ink-abi) | Shared value descriptors, transport layouts and execution decisions |
| [Native support](https://github.com/siliconjungle/ink-native-support) | Generated value, ownership, collection and state primitives |
| [Lowerings](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/backend-packages.md) | C, Rust, JavaScript, Wasm and GPU emission |

The core builds independently. The distribution pins the other packages. Proof checking runs locally in Rust; Lean is optional research tooling.

## 2 An inventory program

This is supported source, checked with the compiler. It stores items, exposes their stock, and defines a total. The smaller [homepage example](https://siliconjungle.github.io/ink-spec-site/#a-small-example) shows the same structure.

```ink
module inventory;

id ItemId;

record Item {
    name: String,
    stock: u32,
}

enum Error {
    Missing,
    AlreadyExists,
    Overflow,
}

record StockChanged {
    item: ItemId,
    before: u32,
    after: u32,
}

state Items: Table<ItemId, Item> = Table.empty();
event stock_changed: StockChanged;

keep total_units: Int =
    sum(Items.values().map(fn(item) => Int(item.stock)));

change create(id: ItemId, name: String, stock: u32)
    -> Result<Unit, Error>
    writes(Items)
{
    if Items.contains(id) {
        return Err(Error.AlreadyExists);
    }
    Items.insert(id, Item { name: name, stock: stock });
    return Ok(());
}

change restock(id: ItemId, amount: u32)
    -> Result<Unit, Error>
    writes(Items)
    emits(stock_changed)
{
    let item = Items.get(id).ok_or(Error.Missing)?;
    let next = checked_add(item.stock, amount)
        .map_err(fn(_) => Error.Overflow)?;

    Items.replace(id, Item { name: item.name, stock: next });
    emit stock_changed(StockChanged {
        item: id,
        before: item.stock,
        after: next,
    });
    return Ok(());
}

query stock_of(id: ItemId) -> Option<u32>
    reads(Items)
{
    return Items.get(id).map(fn(item) => item.stock);
}

query total() -> Int reads(total_units) {
    return total_units;
}
```

`create` rejects an existing item. `restock` rejects a missing item or arithmetic overflow. A successful change commits its writes and ordered events together; a failed change discards them. `total_units` describes the result, without prescribing whether an implementation recomputes or maintains it.

## 3 Values and types

Declarations have concrete parameter, result and field types. Local bindings can infer a type from context.

| Supported type | Meaning and boundary |
| --- | --- |
| `Unit`, `Bool` | Unit `()` and Boolean values |
| `u32`, `u64`, `i32` | Wrapping fixed-width integers; `i32` comparisons are signed |
| `Int` | Exact arbitrary-precision integer values, subject to host resource limits |
| `f32` | Binary32 values with specified rounding and bit transport |
| `Vec2<T>`, `Vec3<T>`, `Vec4<T>` | Fixed numerical vectors of `u32`, `i32` or `f32` |
| `String` | Immutable UTF-8 text |
| `Option<T>`, `Result<T,E>` | Explicit absence and recoverable failure |
| `List<T>` | Ordered immutable finite sequences |
| Records | Named fields with declared types |
| Enums | Named variants, including bounded payload enums and exhaustive matching |
| `Array<T,N>` | Immutable fixed shape, with 0–64 elements; elaborated into a checked record |
| `id` declarations | Nominal 128-bit identifiers |
| `Table<K,V>` | Declared state roots, accessed through permitted actions |
| `Buffer<T>`, `Map<K,V>` | Owned invocation-local storage used inside pure helpers |

Tables are resources, not ordinary values: they cannot be returned, copied into locals, nested in records or passed as parameters. Supported table keys are `u32`, `u64`, `i32`, `Bool`, strings and nominal IDs; other key types are rejected. Owned buffers/maps cannot enter persistent state, keeps, events or action signatures. Local map keys are `u32`, `u64`, `i32` or `Bool`.

```ink
module geometry;

record Point {
    x: f32,
    y: f32,
}

enum Colour {
    Red,
    Blue,
}

fn move(p: Point, dx: f32) -> Point {
    return Point { x: p.x + dx, y: p.y };
}
```

Type aliases, type/constant parameters and payload enums are supported through bounded elaboration. Generic applications use explicit arguments, such as `identity<u32>(7)`. Payload enums use the existing record/sum wire encoding; their host values are not a new variant-labelled JSON format.

`std:json` supplies an ordinary recursive `Json` datatype with Null, Boolean, Number, Text, Array and Object variants. Number stores its exact JSON token; object members are ordered source values. Constructors, accessors, field replacement/removal and projection live in the knowledge library. Checked text adapters reject duplicate keys, invalid number tokens and malformed Unicode. Missing is `None`; present null is `Some(Json.Null)`.

`Nat`, packed `Bytes`, `f64`, the other integer widths, a general dependent `Prop`/`Proof` value language remain design proposals. Source specifications and invariants create checked obligations; database properties can justify erased computations and physical capacity hints. `Set<T>` is an external library alias with normalising operations, rather than a built-in invariant-bearing type. See [generic language foundations](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/generic-language-foundations.md) for instantiation, wire and resource limits.

Fixed-width `+`, `-` and `*` wrap; `checked_add`, `checked_sub` and `checked_mul` return an overflow result instead. `Int` arithmetic is exact. Conversions are explicit. Scalar `f32` comparisons use IEEE rules, while stored aggregate equality compares contained float bits, including signed zeros and NaN payloads.

See [numerical state](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/numerical-state.md) and [local collections](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/local-collections.md) for detailed boundaries.

## 4 Functions

A `fn` is pure. It cannot read state, call an action or emit an event. Bodies support lexical bindings, conditionals, early returns and bounded local iteration. Types, ownership and termination are checked after surface elaboration.

```ink
module totals;

fn total(xs: List<u64>, scale: u64) -> u64 {
    let scaled = xs.map(fn(x) => x * scale);
    return sum(scaled);
}

fn positive(x: i32) -> i32 {
    return choose(x > 0, x, 0);
}
```

`choose(condition, yes, no)` evaluates only the selected branch. Arguments normally evaluate left to right; `&&` and `||` short-circuit. Lambdas use `fn(x) => expression` inside supported higher-order operations. Generic functions require explicit type arguments. Pure unary callback parameters use `fn(T)->U`; named functions or literal lambdas are specialised before execution. Captured owners, escaping callbacks and functions returning callable values are rejected.

`repeat(BOUND, initial, fn(i) => fn(acc) => expression)` has a literal bound of at most 65,536. `repeat_until` accepts a runtime `u32` bound and a stopping predicate. Guarded self recursion supports unsigned/list descent, including admitted lexicographic measures. Mutual recursion and arbitrary partial functions remain unsupported.

`var` locals have explicit types. Pure `for` loops traverse finite lists in order or literal half-open `u32` ranges of at most 65,536 steps. A `while` requires a literal `limit`; reaching the limit continues with the current values. Effectful action loops are unsupported. Local assignment is supported, but does not bypass affine ownership.

```ink
module batches;
type Sequence<T> = List<T>;

fn first<T>(xs: Sequence<T>, fallback: T) -> T {
    return xs.at_or(0, fallback);
}

fn example() -> u32 {
    return first<u32>([7, 8, 9], 0);
}

fn total(xs: List<u32>) -> u32 {
    var result: u32 = 0;
    for item in xs { result = result + item; }
    return result;
}
```

Owned buffers/maps support temporary mutation through consuming operations and rebinding. The checker rejects reuse after a move and captured owners consumed by repeated callbacks. `parallel_map` preserves result order; worker scheduling and grain size affect cost, not that order. Scoped `split_at` partitions share disjoint ranges; adjacent rejoining can reuse storage. Partial-range growth detaches before overlap. The consuming `fill_range(start, count, value)` clips writes to a buffer range; `copy_within(start, count, destination)` uses snapshot-copy semantics with clipped ranges. Range arithmetic does not wrap. These mechanisms do not expose mutable references or a general borrow syntax.

See [checked recursion and ordered parallel work](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/bend-inspired.md).

## 5 State and changes

A table `state` declares a root initialised with `Table.empty()`. Immutable value state can also declare an initial value and use transactional assignment. A `change` runs as an atomic transaction: `Result` changes commit on `Ok` and abort on `Err`; non-`Result` changes commit on normal return. A non-`Result` change cannot propagate an abort. A `query` reads without committing. `writes` permits reading and updating named roots, `reads` adds read-only access, and `emits` permits named event channels. Undeclared access is rejected.

Changes see their own tentative writes. Nested changes share the caller's transaction. A failed nested change remains an abort even if the caller discards its return value. Query errors are ordinary values unless propagated with `?`. There are no independent nested commits or savepoints. `private state` restricts source access from importing modules; it does not encrypt snapshots.

| Table operation | Result and condition |
| --- | --- |
| `Rows.get(key)` | `Option<V>` |
| `Rows.contains(key)` | `Bool` |
| `Rows.values()` | `List<V>` in canonical key order |
| `Rows.keys()` | `List<K>` in canonical key order |
| `Rows.intersect_keys(keys)` | Distinct requested keys present in the table, in canonical key order |
| `Rows.shared_keys(Other)` | Canonically ordered shared keys of same-key-type roots |
| `Rows.sum_by(fn(row) => contribution)` | Ordered numerical contributions |
| `Rows.count_where(fn(row) => predicate)` | Exact `Int` count |
| `Rows.insert(key, value)` | `Unit`; absence must be established |
| `Rows.replace(key, value)` | `Unit`; presence must be established |
| `Rows.remove(key)` | Removed `Option<V>`; absence is allowed |
| `Rows.put(key, value)` | Upsert without a presence branch |
| `Rows.put_many(keys, values)` | Ordered bulk upsert; returns an error for mismatched lengths |
| `Rows.remove_many(keys)` | Ordered bulk removal; absence is allowed |

A `contains` branch can establish the condition for `insert` or `replace`, as in the homepage example. There are no general fallible insert/replace variants. Successful changes advance the `u64` commit version. Version exhaustion aborts a change; queries do not advance it.

See [typed actions](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/typed-actions.md) and [action effects](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/action-effects.md).

## 6 Keeping results up to date

`keep name: T = expression;` defines a value derived from state. It cannot perform writes or emit events. Keep/action dependencies cannot form cycles.

A keep behaves as if evaluated against the state its reader sees, including tentative writes inside a change. An implementation may recompute, cache or incrementally maintain it if the required semantics are preserved. The ordinary JavaScript backend retains deterministic scalar keeps until an actual checked table dependency changes. Abort restores retained before-images; restore and host rollback clear auxiliary caches. Composite keeps retain their existing ownership path. Retention can avoid an unchanged query, but a relevant write may still require a full scan; a `keep` declaration alone does not promise an incremental update algorithm.

Lists preserve order and duplicates. Table values follow canonical key order. Collection operations include map, filter, count, sum, ordered folds, stopping folds, indexed map, zip, concatenation, scan, sort, `take` and `drop`. Slice counts clamp at the list length. `unique`, `unique_ids` and `unique_by` compute exact structural uniqueness; `multiset` observes finite multiplicities, including raw floating-point bits. `count` infers exact `Int`, with `u64` available when explicitly expected. Their accepted types differ. `foldr` and `fold_until` have distinct right-to-left and forward stopping semantics. `zip` stops at the shorter input; `concat` appends in order; integer scan is inclusive. `at_or` evaluates its fallback only when the index is out of range.

Grouping, stable sets and equijoins are ordinary generic definitions in `knowledge/libraries/collections.ink`. Their baseline algorithms and order/duplicate semantics are explicit; a nested-loop join can be quadratic. They are not privileged compiler operators. A checked rewrite can remove ordering work only when its observation permits that. See [collection pipelines](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/collection-pipelines.md) and [sequence semantics](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/sequence-semantics.md).

## 7 Inputs and events

`event channel: Payload;` declares an output. `emit channel(value);` stages it inside a change. A successful commit publishes events in source order; abort discards them. Pending events remain in the outbox until acknowledged.

Time, randomness and external responses must enter as explicit inputs. Source functions and queries do not obtain them from the host.

Durable hosts can persist state and deliver events with retries. Delivery is at least once; the receiver must deduplicate for an exactly-once effect. File and IndexedDB adapters have explicit storage and writer guarantees. These are host contracts, not language-level distributed replication. See [durable state](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/durable-host.md).

## 8 Proofs and contracts

Optimisation proofs are database objects, checked by Ink's Rust checker. The supported calculi include typed equality, congruence, theorem application, cases, structural induction, exact-Int inequality certificates and checked word-arithmetic certificates, with separate admission boundaries for different uses.

Fallible `requires(predicate, error)` and `ensures(result => predicate, error)` clauses are supported on compatible `Result` functions and actions. Requirements run before the body; postconditions check each normal return, including `Err`, in declaration order. Failure in a change aborts its transaction. They are runtime validations, not static refinement facts.

```ink
module contracts;
enum Error { Input, Output, }

fn increment(x: u32) -> Result<u32, Error>
    requires(x > 0, Error.Input)
    ensures(reply => reply.fold(fn(v) => v < 10, fn(e) => true), Error.Output)
{
    return Ok(x + 1);
}
```

External law files use ordinary `rewrite` declarations and `ink emit-laws` to check and export canonical evidence. Executable application modules still reject inline rewrites. The broader dependent theorem/tactic language remains a design proposal. See [contracts and law authoring](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/generic-language-foundations.md#fallible-contracts-and-external-theorem-authoring).

Source `spec fn`, `spec query` and `spec change` declarations instead create static obligations. Every named `implementation` must satisfy the clauses; source callers must discharge static `requires`, and public checked value/JSON hosts validate input preconditions. `result` names the result, `before(...)` observes an action's input state, and `invariant` must hold initially and after public actions. Evidence binds the actual source; specifications are not trusted annotations. An unconstrained part of a specification remains unconstrained, including event history unless another proof preserves it.

```ink
module contracts_static;
spec fn next(x: u32) -> u32 ensures result == x + 1;
implementation direct for next { return x + 1; }
implementation commuted for next { return 1 + x; }
```

`ink emit-contract-obligations`, `ink check-contracts` and `--contract-proofs` expose ordinary external proof transport. Public invariant and precondition checks remain at their defined ingress boundaries. [Source contracts](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/source-contracts.md) describes the exact supported state observations.

Proof authors and search tools propose evidence. The core checks the actual proof bytes and applicable premises. A solver result, entry name, hash or performance observation cannot replace that check. Lean is not required to compile ordinary programs.

## 9 What a proof guarantees

| Claim | Scope |
| --- | --- |
| An accepted transformation preserves meaning | The admitted mathematical domain, exact program and discharged premises |
| A transformation is applicable | Conditions established at the actual use site |
| A selected implementation is profitable | Comparable performance evidence, separate from proof admission |
| Generated machine code is correct | Not established by accepting a high-level rewrite |

Execution supports more operations than proof-based replacement. Some complete action transitions and physical representations have source-bound proof paths; unsupported operators and keys fail closed. Code/value binding alone does not prove an interpreter correct.

The Rust checker, source correspondence, codecs, lowerers, hosts, toolchains and drivers remain trusted implementations. The optional Lean Boolean verdict proves a separate limited calculus; it does not verify the compiler or its translator.

## 10 Writing optimisation rules

Rules live in the knowledge database, with typed interfaces, dependencies, conditions and proofs. The planner proposes applications; the compiler checks them against the actual program. Inline `rewrite` declarations are rejected by executable-core admission, even though the parser recognises a historical syntax.

A map-fusion law can combine successive pure maps. Database source-algorithm templates can also introduce typed helpers, records and scratch types absent from the original program, then prove their replacement against the extended module. Extensions pass normal type, ownership and termination checks; an extension alone grants no rewrite authority. A buffer-edit law can remove a private write overwritten before observation. Neither law may silently change events or transaction boundaries.

`ink emit-laws THEOREMS.ink -o BUNDLE.json` checks external rewrite evidence. `--proofs` supplies existing canonical evidence for a provided proof, and `--view` supplies authenticated dependencies. Labels and tactic spellings grant no authority.

Representation entries can describe layouts and maintained results under additional source/action preservation obligations. Representation authoring is database data. Named source `implementation ... for ...` declarations implement specifications, with their own checked refinement obligations; they are not a physical layout declaration.

See [semantic optimisation](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/semantic-optimisation.md) and [collection edit laws](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/collection-edit-laws.md).

## 11 Changing representations

A representation connects logical state to a physical implementation. Admission requires encoding/decoding relations, observation correctness and invariant preservation for every covered source action. Replies, aborts, versions, logical post-state and ordered events are included.

Accepted representations compile into ordinary standalone state programs. Normal calls do not reconstruct and validate a full logical snapshot. There is no generic proof-aware representation interpreter inside the emitted application. Explicit checkpoint/restore retains logical snapshot validation at that boundary.

To switch compiled variants, checkpoint the old instance between transactions, restore into the target, then publish the target only after restoration succeeds. Direct bridge proofs remain checkable, but optimised direct-bridge emission and an autonomous live switching controller are not implemented.

Knowledge-defined implementations now include typed multi-table indexed storage, cached admitted aggregate decompositions and grouped replace/remove traversals. Complete action proofs preserve intermediate reads, replies, errors, events, versions and rollback. Unsupported decompositions retain exact source evaluation; an arbitrary predicate does not imply a constant-size cache. See [typed indexed batching](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/general-indexed-batching.md).

Standalone representation calls have trusted-caller type and value obligations. Their checkpoint codecs check integrity separately. See [representation contracts](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/database-representations.md).

## 12 The knowledge database

The canonical store contains immutable content-addressed definitions, laws, theorems, representations and bridges with exact dependencies. Pinned snapshots authenticate membership. SQLite is a rebuildable discovery index; storage grants no mathematical authority.

The planner composes independently checked expression/action rewrites, source extensions, representations, definition choices, properties, physical layouts, graph resources and routing. Database-owned recipes discover installed families; search may revisit layers to a fixed point or a resource limit. The typed memo retains alternatives and checked edges. Complete-action and representation replacements have separate proof obligations. A valid law in one domain does not automatically grant authority in another.

`ink-compiled-plan-v1` chains and `ink-evidence-v1` selections carry their pinned evidence and replay without the producer, SQLite or a live database. Performance observations are separate objects, matched to exact code, target and workload boundaries. Database growth adds candidates; bounded search does not guarantee a global optimum. Optional learned/stochastic ranking, shared-budget restarts, parallel CPU search and offline autotuning propose alternatives; exact proof admission remains independent. Similarity and sampled outputs never prove equivalence.

See [database planning](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/database-planning.md), [database-authored algorithms](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/database-executable-extensions.md) and [the data contract](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/repository-architecture.md).

## 13 Choosing an implementation

Correctness, applicability and cost are separate decisions. An equivalent candidate can be slower. Selection can account for checking, compilation, initialisation, calls, copying, memory, teardown and migration.

Offline compilation automatically discovers compatible immutable usage recordings and uses call frequencies, shapes and concurrency to guide exploration. Recordings contain bounded metadata, not input values; independent windows and cumulative snapshots avoid double-counting. Measurements must cover every observed cohort and required lifecycle phase. Recording is opt-in and never establishes applicability. Measured representation selection is an explicit offline process. It needs comparable evidence for the required lifecycle phases. Missing evidence retains the baseline. Search and checking have resource limits; an unproved proposal cannot become valid because it has a low estimated cost.

See [observed usage and certified resources](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/proved-usage-planning.md) and [lifecycle selection](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/reports/incremental-maintenance-selection/README.md).

## 14 Runtime selection

Eligible pure CPU/JavaScript/GPU implementations can be selected using saved, target-bound cost profiles and request metadata. The common decision code lives in `ink-abi` and runs natively or through Wasm in the browser. Missing comparable evidence or a profile-domain miss keeps compiled CPU execution. Device failure can fall back to CPU.

Compiled pure browser pipelines can combine native JavaScript, Wasm and GPU groups, prepared resources and worker execution using opt-in, workload-bound profiles. Stateful transactions remain on the host.

Database-selected resource plans can release inputs and intermediates at checked final uses and impose request/captured-byte credits. Browser calls capture accepted inputs synchronously and execute in order; exhaustion rejects with `INK_BACKPRESSURE`, and completion or failure returns credits. These credits do not bound total process or device memory. Unknown future demand still requires runtime admission.

The runtime performs no profitability probes. Measurement collection and model fitting happen offline. Stateful actions are not repeatedly executed to compare targets.

General live recompilation and automatic representation migration remain proposals. Explicit static backend selection and prepared GPU sessions are available under their documented contracts. See [execution policy](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/adaptive-execution.md).

## 15 Saving and restoring state

A portable checkpoint records program/schema identities, committed version, logical tables and pending outbox events. It does not record raw pointers, arbitrary call stacks, a general task queue or a separate durable retry ledger.

Checkpoints are taken between transactions. Compatible reference, native, JavaScript and Wasm implementations of the same checked program can exchange them. Checked selections retain the original program's checkpoint identity; independently edited source does not acquire that identity.

The canonical binary format checks sizes, identities, ordering, tags and integrity. Physical caches are rebuilt by the receiving implementation. Integrity detects corruption; it does not authenticate the sender.

Durable hosts use retained journals or immutable roots and append compiled operations with retry receipts between periodic checkpoints. Recovery restores a checkpoint and replays committed operations under the host contract; new query IDs persist receipts without replaying their queries. Native files and IndexedDB have explicit storage and single-writer requirements. Schema evolution and persistent task scheduling remain outside the language. See [incremental durability](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/indexed-aggregate-durable.md).

See [portable snapshots](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/portable-snapshot.md), [selected checkpoints](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/selected-checkpoints.md) and [durable hosts](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/durable-host.md).

## 16 Code as data

Ink has versioned executable-core objects and content-addressed knowledge entries. `emit-core` exports a checked typed program; replay reruns structural, type, effect and version checks. The exact identity describes a particular program, not its equivalence class.

Source/value witnesses can bind complete source and supported values to database definitions. Binding data alone does not supply an executable equivalence proof.

Proof admission can reuse checked closures against the same exact snapshot and executable module. Optional planner caches bind the compiler, source, knowledge, producer code, budgets and supplied profile context; cached proposals are rechecked before use. Knowledge publication also reuses unchanged Merkle/index work.

A unified editable store for code, schemas and state, unrestricted incremental compilation and persistent captured callbacks remain design work. See [reuse boundaries](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/storage-bulk-incremental.md#reusing-compiler-work).

## 17 Compilation

The compiler checks source and selected evidence before target emission. Backends emit the accepted computation literally and report unsupported capabilities. The independent reference evaluator remains in core.

Core versions describe actual operations and contracts. Current programs may use versions through V10; the checker derives the required marker and rejects a mismatched one. V7 fixes binary32 arithmetic behaviour; V8 binds the expanded value operations, V9 binds bulk owned-buffer ranges, and V10 binds source specifications and invariants. Generic templates elaborate into concrete checked programs before encoding. Older programs retain their applicable version.

`ink-runtime` assembles artifacts and supplies host orchestration. `ink-abi` defines shared transport and decisions; `ink-native-support` supplies emitted value/storage primitives. A browser application can run precompiled code without shipping the optimiser or proof search.

## 18 Execution targets

C and Rust toolchains produce native code and WebAssembly. JavaScript emits importable ES modules. WebGPU/wgpu runs eligible pure kernels; transactions and recursive physical state execute on the host.

Supported `f32` arithmetic rounds in source order to binary32 and produces canonical arithmetic NaNs. Transport and sign-bit negation preserve payload bits. The packed GPU emitter uses integer lanes for this contract; the earlier portable WGSL float description is not the current binary32 contract. Eligible device work does not imply all types or programs run on the GPU.

Some direct pure generated entries use trusted-caller interfaces. Host submission wrappers, state invocation and checkpoint codecs have their own input and resource checks. There is no universal promise that every entry validates arbitrary JavaScript values. Ordinary state invocation and standalone representation invocation also have different contracts.

### JavaScript

```sh
ink build prices.ink --target javascript -o prices.mjs
```

Using the [homepage program](https://siliconjungle.github.io/ink-spec-site/#a-small-example):

```js
import { createState } from './prices.mjs';

const state = createState();
state.invoke('set_price', [1n, 1200n]);
console.log(state.invoke('total', []).result); // 1200n

const saved = await state.checkpoint();
const restored = createState();
await restored.restore(saved);
```

Pure functions are exported through `functions.name(...args)` and dynamic `call(name, args)`. `u64` results are BigInt; JSON hosts must encode them explicitly. Ordinary state modules export `createState()`. Deterministic scalar keeps retain results across unchanged dependencies; admitted compiled representations can use other proved maintenance algorithms. Resolve a typed entry once with `state.bind(name)`; `{ resultOnly: true }` returns its result while preserving transactions and the committed outbox. Typed bound scalar inputs are a caller obligation, and composite inputs/results retain their ownership contracts.

Generated JavaScript modules also export `ValueCodec`, `JsonCodec`, `TypedJsonCodec`, `valueCodecs` and `callBinary(name, bytes)`. The schema-bound `ink-value-wire-v1` format transports ordinary declared values as binary buffers, preserving exact Int/word values and raw f32 bits. JSON conversion is a separate, fallible boundary. Native C/Rust expose `State::call_binary`; the optional C/Wasm export is `lang_call_binary`, with `StateInstance.pureBinary` on Wasm hosts. Rust borrowed validation can inspect and relay bytes without building a document tree. Structural validation alone does not establish a source precondition. [JSON and portable values](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/json-and-portable-values.md) defines schemas, limits, number policies and the trust boundary.

`choose`, Boolean short-circuiting and `at_or` have lazy branches. Option/Result argument evaluation follows each operation's contract; for example, action `ok_or` evaluates its fallback eagerly. See [JavaScript](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/javascript-backend.md), [target parity](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/lowering-parity.md), [binary32 semantics](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/numerical-state.md) and [ordered work](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/bend-inspired.md).

## 19 Modules and commands

Imports name explicit relative source files or embedded standard helpers:

```ink
module app;
import "std:words" as words;

fn limited(n: u32) -> u32 {
    return words.clamp32(n, 0, 100);
}
```

Top-level declarations are accessible through their import namespace. `std:json` embeds the distribution's pinned knowledge library. The browser editor remains a single-file compiler; the [JSON flow demo](./json.html) runs a precompiled linked program. Concrete root functions with public value signatures are host entry points; uninstantiated templates and owned Buffer/Map helpers are excluded from the public value interface. The optional `pub` spelling does not provide general private visibility; `private state` has its explicit importing-module boundary. Import cycles, alias shadowing and missing declarations are rejected. Network package resolution and private exports are not implemented.

Useful current commands include:

```sh
ink check prices.ink
ink modules prices.ink
ink explain prices.ink
ink build prices.ink --target javascript -o prices.mjs
ink execute prices.ink history.json --portable --snapshot-out state.bin
ink emit-core prices.ink -o core.json
ink emit-actions prices.ink -o actions.json
ink doctor
```

An execution history is a JSON array of entries such as `{"call":"total","args":[]}`. Pure execution uses `ink run SOURCE FUNCTION ARGS.json`. Expression discovery accepts `--optimise KNOWLEDGE_DIRECTORY` or a snapshot; expression replay uses `--selection SELECTION.json`. Composed implementation planning uses `ink compile` and frozen `--plan` replay:

```sh
ink compile prices.ink --optimise knowledge --target rust \
  --search-budget 16384 --state-limit 4096 --planning-seconds 3600 -o prices.rs
ink compile prices.ink --plan prices.rs.planning.json --target rust -o replayed.rs
```

These examples require an installed knowledge checkout and the named source/packet. Planning saves a search receipt and selected proof chain. Missing comparable lifecycle evidence retains the baseline. `--measure-workload` can acquire explicit offline measurements. Ordinary application execution does not run the optimiser.

Commands such as `ink prove`, `ink knowledge import`, `--mode adaptive` and `ink snapshot inspect` are design proposals, not this CLI.

See [modules](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/modules.md) and [installation](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/installation.md).

## 20 Source syntax

Source is UTF-8; identifiers are case-sensitive ASCII names. Statements use semicolons and blocks use braces. Comments use `//` or non-nesting `/* ... */`. Every file begins with `module name;`, optionally using a dotted module name.

Supported application declarations include `id`, `type` aliases, records, enums with optional payloads, functions, table/value `state`, `private state`, keeps, events, queries, changes, specifications, named implementations and invariants. Eligible declarations accept type parameters and literal `u32` constant parameters. Record and enum entries require trailing commas. Pure bodies admit lexical binding, early returns, conditionals and finite loops; action bodies additionally admit permitted state changes and event emission.

Expressions include numbers, strings, Booleans, unit, list literals, named calls, record construction, fields, supported methods, inline lambdas, lazy conditional expressions and exhaustive `match`. Matching supports Bool, Option, Result and supported enums. Pure `?` is supported in let initialisers; arbitrary nested pure propagation remains unsupported. There is no general tuple or unchecked index-expression syntax. Empty lists require an expected element type.

Precedence from tightest to loosest is calls/fields/postfix `?`, unary `-`/`!`/`~`, `*`, `+`/`-`, comparisons, equality, word `&`, `^`, `|`, Boolean `&&`, `||`. Binary operators associate left. Parentheses override precedence. Word shifts/rotations use named operations with `u32` counts. Unchecked `/` and `%` are not admitted source operators; `quot_or` and `rem_or` have lazy fallback, and the external integer library provides checked division/remainder.

Positive integer literals use contextual numeric types or default to `u64`; an unconstrained unary negative expression defaults to `i32`. Decimal/exponent literals are `f32`. Integer tokens are bounded by `u64`; use `Int` conversions/operations for exact integer computation. Floating literals must be finite. Numeric overflow, inference and conversion rules are checked rather than inherited from JavaScript.

The full design draft's grammar also contains unsupported proposals. This section describes the current parser; [the parser source](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/core/src/syntax.rs) is the exact syntax authority for the linked revision.

## 21 Measuring performance

Measure complete returned results and matching semantics. Useful costs include construction, updates, queries, copying, memory, proof checking, compilation, migration and teardown. GPU uploads, dispatches and readbacks matter alongside kernel time.

The reports retain both gains and regressions. Beating a rescan does not establish an advantage over a handwritten maintained implementation. Passing conformance does not establish a performance improvement.

The [proof-growth study](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/proof-growth-epoch3.md) holds the compiler fixed while adding reusable law families. Its chosen kernels gain on some targets and regress on others; total entry count does not predict arbitrary-program speed.

See [benchmark evidence](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/BENCHMARKS.md) and [measurement methodology](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/benchmark-methodology.md) for recorded revisions, workloads and boundaries.

## 22 Building Ink

Build the published distribution with Git and Cargo:

```sh
git clone --recurse-submodules https://github.com/siliconjungle/ink-lang.git
cd ink-lang
cargo build --release --locked
printf '[[1, 2, 3], 2]\n' > arguments.json
target/release/ink run examples/hello.ink total arguments.json
# 12
```

The core can build without the knowledge, planner, runtime or lowering checkouts. The full distribution uses exact independent package pins. Native/Wasm/GPU emission requires the relevant toolchains and device support. Python is needed for external knowledge discovery; supplied selections can replay without discovery.

See [installation](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/installation.md) and run `ink doctor` for available tools.

## 23 Current limits

Ink is a working prototype. Source execution, optimisation admission, target eligibility and profitability have separate coverage. General live strategy switching, schema evolution, a general dependent-type language, compact additional numeric carriers and packed Bytes remain unfinished. The standalone [browser editor](https://github.com/siliconjungle/ink-environment) compiles single-file programs locally; automatic external knowledge search, linked imports and native Rust execution are environment limits. Fallible contracts validate at runtime; specifications and certified database properties use the separate proof admission described above. Neither grants unchecked assumptions.

The supported CPU language is broader than the shader subset. Mathematical admission does not prove backend correctness. Unsupported proof domains reject rather than accepting a theorem about a different program.

[Implementation status](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/STATUS.md) lists the published distribution's boundaries. [The plan](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/PLAN.md) records remaining acceptance work. The separate design draft describes ambitions and contains historical implementation overviews; it is not the supported-language reference.

## 24 Maintaining a total

For a table of `u64` weights, replacing a key changes a wrapping total by subtracting the old contribution and adding the new one. Treat an absent contribution as zero:

```text
new_total = old_total - previous_value + new_value
```

This is a schematic update equation, not an additional source API. To use it as a representation, the database must supply proofs connecting its initial value and every action to the declared keep, including deletion, abort and future updates.

Fixed-width totals use their wrapping arithmetic. Exact `Int` totals use different arithmetic; their admitted source correspondence now covers arithmetic, conversion, sum and count. Their laws must use exact coefficients rather than wrapping word coefficients. Float sums cannot be repaired or reassociated with this equation merely because it looks algebraically familiar.

Correctness leaves a cost question: reads saved must pay for setup, extra writes, storage and migration. A simple recomputing implementation may win for a short session.

## 25 Execution and proof objects

The transaction model stages writes and events, commits a successful change once, and discards them on abort. Nested changes share that boundary. Queries and keeps observe the state appropriate to their caller; pending outbox events are distinct from delivery acknowledgements.

Pure equality concerns returned values in its admitted total domain. Allocation identity, exact fuel accounting and timing are not general observations of that equality. A resource-bounded execution can fail where an equivalent cheaper expression succeeds.

Stateful preservation includes results, errors, commit status, versions, logical state and ordered events across permitted future actions. It requires more than equal answers on sampled inputs.

The implemented proof formats and resource checks live in the [core](https://github.com/siliconjungle/ink-lang/tree/{{ink_revision}}/core). The general dependent proof-term language and richer source tactics in the design draft remain proposals; current static specifications and ordinary database certificates use the admitted kernels. Tests and adversarial fixtures validate the implementation within their scope; they do not substitute for its mathematical admission obligations or prove the checker itself.
