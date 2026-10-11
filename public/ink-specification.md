# Ink implementation reference

Reviewed against [published implementation 1452414](https://github.com/siliconjungle/ink-lang/tree/14524142b25e9de65f470ba2cbae84e500aecb5f). This describes supported behaviour; wider proposals and historical overviews are in the [separate design draft](https://siliconjungle.github.io/ink-spec-site/ink-design-draft.md).

## 1 How it works

Ink compiles state and computation together. You define the data, the changes it permits and the results you need. The compiler checks the program, checks any proposed optimisation evidence, and emits an implementation for the selected target.

This page describes the published implementation linked in the footer. Wider proposals are in the separate design draft. Execution support and proof-based replacement support have different limits.

| Part | Responsibility |
| --- | --- |
| [Semantic core](https://github.com/siliconjungle/ink-lang/tree/14524142b25e9de65f470ba2cbae84e500aecb5f/core) | Types, fixed semantics, reference execution and general evidence checking |
| [Knowledge](https://github.com/siliconjungle/ink-knowledge) | Immutable definitions, laws, proofs, snapshots and separate performance observations |
| [Planner](https://github.com/siliconjungle/ink-planner) | Bounded search, applicability evidence and cost selection |
| [Runtime](https://github.com/siliconjungle/ink-runtime) | Artifact assembly, scheduling, saved-profile selection, host adapters and fallback |
| [ABI](https://github.com/siliconjungle/ink-abi) | Shared value descriptors, transport layouts and execution decisions |
| [Native support](https://github.com/siliconjungle/ink-native-support) | Generated value, ownership, collection and state primitives |
| [Lowerings](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/docs/backend-packages.md) | C, Rust, JavaScript, Wasm and GPU emission |

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
| Enums | Named variants without payloads |
| `id` declarations | Nominal 128-bit identifiers |
| `Table<K,V>` | Declared state roots, accessed through permitted actions |
| `Buffer<T>`, `Map<K,V>` | Owned invocation-local storage used inside pure helpers |

Tables are resources, not ordinary values: they cannot be returned, copied into locals, nested in records or passed as parameters. Supported table keys are `u32`, `u64`, `i32`, strings and nominal IDs; other key types are rejected. Owned buffers/maps cannot enter persistent state, keeps, events or action signatures. Local map keys are `u32`, `u64`, `i32` or `Bool`.

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

`Nat`, `Bytes`, `f64`, the other integer widths, fixed-length `Array`, `Set`, refinement types, generic declarations, enum payloads and source-level `Prop`/`Proof` types are design proposals. They are not built-in types or syntax in this compiler.

Fixed-width `+`, `-` and `*` wrap; `checked_add`, `checked_sub` and `checked_mul` return an overflow result instead. `Int` arithmetic is exact. Conversions are explicit. Scalar `f32` comparisons use IEEE rules, while stored aggregate equality compares contained float bits, including signed zeros and NaN payloads.

See [numerical state](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/docs/numerical-state.md) and [local collections](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/docs/local-collections.md) for detailed boundaries.

## 4 Functions

A `fn` is pure. It cannot read state, call an action or emit an event. Its body contains sequential `let` bindings followed by a return expression.

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

`choose(condition, yes, no)` evaluates only the selected branch. Arguments normally evaluate left to right; `&&` and `||` short-circuit. Lambdas use `fn(x) => expression` inside supported higher-order operations. Generic functions and arbitrary first-class function signatures are not supported.

`repeat(BOUND, initial, fn(i) => fn(acc) => expression)` has a literal bound of at most 65,536. `repeat_until` accepts a runtime `u32` bound and a stopping predicate. Guarded self recursion is supported when the checker establishes descent of an unsigned word or list parameter. Mutual recursion, `partial fn`, `while`, statement `for`, `var` and local assignment are not source constructs today.

Owned buffers/maps support temporary mutation through consuming operations and rebinding. The checker rejects reuse after a move and captured owners consumed by repeated callbacks. `parallel_map` preserves result order; worker scheduling and grain size affect cost, not that order. These mechanisms do not expose mutable references or a general borrow syntax.

See [checked recursion and ordered parallel work](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/docs/bend-inspired.md).

## 5 State and changes

A `state` declares a table root, initialised with `Table.empty()`. A `change` must return `Result<T,E>` and runs as an atomic transaction. A `query` reads without committing. `writes` permits reading and updating named roots, `reads` adds read-only access, and `emits` permits named event channels. Undeclared access is rejected.

Changes see their own tentative writes. Nested changes share the caller's transaction. A failed nested change remains an abort even if the caller discards its return value. Query errors are ordinary values unless propagated with `?`. There are no independent nested commits or savepoints.

| Table operation | Result and condition |
| --- | --- |
| `Rows.get(key)` | `Option<V>` |
| `Rows.contains(key)` | `Bool` |
| `Rows.values()` | `List<V>` in canonical key order |
| `Rows.insert(key, value)` | `Unit`; absence must be established |
| `Rows.replace(key, value)` | `Unit`; presence must be established |
| `Rows.remove(key)` | Removed `Option<V>`; absence is allowed |

A `contains` branch can establish the condition for `insert` or `replace`, as in the homepage example. There are no general fallible insert/replace variants. Successful changes advance the `u64` commit version. Version exhaustion aborts a change; queries do not advance it.

See [typed actions](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/docs/typed-actions.md) and [action effects](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/docs/action-effects.md).

## 6 Keeping results up to date

`keep name: T = expression;` defines a value derived from state. It cannot perform writes or emit events. Keep/action dependencies cannot form cycles.

A keep behaves as if evaluated against the state its reader sees, including tentative writes inside a change. An implementation may recompute, cache or incrementally maintain it if the required semantics are preserved. Baseline JavaScript keeps recompute; a `keep` declaration alone is not a promise of incremental execution.

Lists preserve order and duplicates. Table values follow canonical key order. Collection operations include supported forms of map, filter, count, sum, right fold, stopping fold, indexed map, zip, concatenation, scan and sort. Their accepted types differ. `foldr` and `fold_until` have distinct right-to-left and forward stopping semantics. `zip` stops at the shorter input; `concat` appends in order; integer scan is inclusive. `at_or` evaluates its fallback only when the index is out of range.

Automatic unbounded grouping and joins are not general source operators. A checked rewrite can remove ordering work only when its observation permits that. See [collection pipelines](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/docs/collection-pipelines.md) and [sequence semantics](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/docs/sequence-semantics.md).

## 7 Inputs and events

`event channel: Payload;` declares an output. `emit channel(value);` stages it inside a change. A successful commit publishes events in source order; abort discards them. Pending events remain in the outbox until acknowledged.

Time, randomness and external responses must enter as explicit inputs. Source functions and queries do not obtain them from the host.

Durable hosts can persist state and deliver events with retries. Delivery is at least once; the receiver must deduplicate for an exactly-once effect. File and IndexedDB adapters have explicit storage and writer guarantees. These are host contracts, not language-level distributed replication. See [durable state](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/docs/durable-host.md).

## 8 Proofs and contracts

Optimisation proofs are database objects, checked by Ink's Rust checker. The supported calculi include typed equality, congruence, theorem application, cases, structural induction and checked word-arithmetic certificates, with separate admission boundaries for different uses.

The compiler does not accept source declarations such as `theorem`, `requires`, `ensures` or `proof by induction`. Those belong to the design draft. Source type/effect checks and table-presence checks are implemented; they are not a general user-authored contract language.

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

A map-fusion law can combine successive pure maps. A buffer-edit law can remove a private write overwritten before observation. Neither law may silently change events or transaction boundaries.

Representation entries can describe layouts and maintained results under additional source/action preservation obligations. Their authoring interface is database data, not an implemented `implementation ... for ...` source declaration.

See [semantic optimisation](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/docs/semantic-optimisation.md) and [collection edit laws](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/docs/collection-edit-laws.md).

## 11 Changing representations

A representation connects logical state to a physical implementation. Admission requires encoding/decoding relations, observation correctness and invariant preservation for every covered source action. Replies, aborts, versions, logical post-state and ordered events are included.

Accepted representations compile into ordinary standalone state programs. Normal calls do not reconstruct and validate a full logical snapshot. There is no generic proof-aware representation interpreter inside the emitted application. Explicit checkpoint/restore retains logical snapshot validation at that boundary.

To switch compiled variants, checkpoint the old instance between transactions, restore into the target, then publish the target only after restoration succeeds. Direct bridge proofs remain checkable, but optimised direct-bridge emission and an autonomous live switching controller are not implemented.

Standalone representation calls have trusted-caller type and value obligations. Their checkpoint codecs check integrity separately. See [representation contracts](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/docs/database-representations.md).

## 12 The knowledge database

The canonical store contains immutable content-addressed definitions, laws, theorems, representations and bridges with exact dependencies. Pinned snapshots authenticate membership. SQLite is a rebuildable discovery index; storage grants no mathematical authority.

The planner searches supported pure expressions and eligible pure action regions. Complete-action and representation replacements have separate proof obligations. A valid law in one domain does not automatically grant authority in another.

`ink-evidence-v1` selections carry their pinned evidence and replay without the producer, SQLite or a live database. Performance observations are separate objects, matched to exact code, target and workload boundaries. Database growth adds candidates; bounded search does not guarantee a global optimum.

See [the data contract](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/docs/repository-architecture.md).

## 13 Choosing an implementation

Correctness, applicability and cost are separate decisions. An equivalent candidate can be slower. Selection can account for checking, compilation, initialisation, calls, copying, memory, teardown and migration.

Measured representation selection is an explicit offline process. It needs comparable evidence for the required lifecycle phases. Missing evidence retains the baseline. Search and checking have resource limits; an unproved proposal cannot become valid because it has a low estimated cost.

See [lifecycle selection](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/reports/incremental-maintenance-selection/README.md).

## 14 Runtime selection

Eligible pure CPU/JavaScript/GPU implementations can be selected using saved, target-bound cost profiles and request metadata. The common decision code lives in `ink-abi` and runs natively or through Wasm in the browser. Missing comparable evidence or a profile-domain miss keeps compiled CPU execution. Device failure can fall back to CPU.

The runtime performs no profitability probes. Measurement collection and model fitting happen offline. Stateful actions are not repeatedly executed to compare targets.

General live recompilation and automatic representation migration remain proposals. Explicit static backend selection and prepared GPU sessions are available under their documented contracts. See [execution policy](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/docs/adaptive-execution.md).

## 15 Saving and restoring state

A portable checkpoint records program/schema identities, committed version, logical tables and pending outbox events. It does not record raw pointers, arbitrary call stacks, a general task queue or a separate durable retry ledger.

Checkpoints are taken between transactions. Compatible reference, native, JavaScript and Wasm implementations of the same checked program can exchange them. Checked selections retain the original program's checkpoint identity; independently edited source does not acquire that identity.

The canonical binary format checks sizes, identities, ordering, tags and integrity. Physical caches are rebuilt by the receiving implementation. Integrity detects corruption; it does not authenticate the sender.

Durable hosts persist a complete checkpoint and retry receipts before returning success, under their storage contract. Recovery reopens the stored record. Schema evolution, general delta-log recovery and persistent task scheduling are not implemented language features.

See [portable snapshots](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/docs/portable-snapshot.md), [selected checkpoints](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/docs/selected-checkpoints.md) and [durable hosts](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/docs/durable-host.md).

## 16 Code as data

Ink has versioned executable-core objects and content-addressed knowledge entries. `emit-core` exports a checked typed program; replay reruns structural, type, effect and version checks. The exact identity describes a particular program, not its equivalence class.

Source/value witnesses can bind complete source and supported values to database definitions. Binding data alone does not supply an executable equivalence proof.

A unified editable store for code, schemas and state, general incremental compilation and persistent captured callbacks remain design work. These are not implied by having a knowledge database.

## 17 Compilation

The compiler checks source and selected evidence before target emission. Backends emit the accepted computation literally and report unsupported capabilities. The independent reference evaluator remains in core.

Core versions describe actual operations and contracts. Current programs may use versions through V7; the checker derives the required marker and rejects a mismatched one. V7 fixes binary32 arithmetic behaviour. Older supported non-floating programs retain their applicable version.

`ink-runtime` assembles artifacts and supplies host orchestration. `ink-abi` defines shared transport and decisions; `ink-native-support` supplies emitted value/storage primitives. A browser application can run precompiled code without shipping the optimiser or proof search.

## 18 Execution targets

C and Rust toolchains produce native code and WebAssembly. JavaScript emits importable ES modules. WebGPU/wgpu runs eligible pure kernels; transactions and recursive physical state execute on the host.

Supported `f32` arithmetic rounds in source order to binary32 and produces canonical arithmetic NaNs. Transport and sign-bit negation preserve payload bits. The packed GPU emitter uses integer lanes for this contract; the earlier portable WGSL float description is not the current V7 contract. Eligible device work does not imply all types or programs run on the GPU.

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

Pure functions are exported through `functions.name(...args)` and dynamic `call(name, args)`. `u64` results are BigInt; JSON hosts must encode them explicitly. Ordinary state modules export `createState()`. Baseline keeps recompute, while admitted compiled representations may use different physical maintenance.

`choose`, Boolean short-circuiting and `at_or` have lazy branches. Option/Result argument evaluation follows each operation's contract; for example, action `ok_or` evaluates its fallback eagerly. See [JavaScript](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/docs/javascript-backend.md), [target parity](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/docs/lowering-parity.md), [binary32 semantics](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/docs/numerical-state.md) and [ordered work](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/docs/bend-inspired.md).

## 19 Modules and commands

Imports name explicit relative source files or embedded standard helpers:

```ink
module app;
import "std:words" as words;

fn limited(n: u32) -> u32 {
    return words.clamp32(n, 0, 100);
}
```

All top-level declarations are accessible through their import namespace. The root module's names remain public host entry points. The optional `pub` spelling does not provide private visibility. Import cycles, alias shadowing and missing declarations are rejected. Network package resolution and private exports are not implemented.

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

An execution history is a JSON array of entries such as `{"call":"total","args":[]}`. Pure execution uses `ink run SOURCE FUNCTION ARGS.json`. Build-time discovery uses `--optimise SNAPSHOT.json`; frozen replay uses `--selection SELECTION.json`. Commands such as `ink prove`, `ink knowledge import`, `--mode adaptive` and `ink snapshot inspect` are design proposals, not this CLI.

See [modules](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/docs/modules.md) and [installation](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/docs/installation.md).

## 20 Source syntax

Source is UTF-8; identifiers are case-sensitive ASCII names. Statements use semicolons and blocks use braces. Comments use `//` or non-nesting `/* ... */`. Every file begins with `module name;`, optionally using a dotted module name.

The supported declaration forms are `id`, `record`, nullary `enum`, `fn`, table `state`, `keep`, `event`, `query` and `change`. Record and enum declaration entries require trailing commas. A pure function has `let` bindings and a return expression; action bodies additionally admit `if`/`else`, event emission and expression statements.

Expressions include numbers, strings, Booleans, unit, named calls, record construction, fields, supported methods, inline lambdas and postfix `?`. There is no general tuple, list-literal, index-expression or `match` syntax. Lists come from arguments or collection operations; bounded loops use the expression primitives described above.

Precedence from tightest to loosest is calls/fields/postfix `?`, unary negation, `*`, `+`/`-`, comparisons, equality, `&&`, `||`. Binary operators associate left. Parentheses override precedence. `/`, `%` and shift operators are not source operators; total integer division/remainder use `quot_or` and `rem_or`, with lazy fallback for their invalid cases.

Positive integer literals use contextual numeric types or default to `u64`; an unconstrained unary negative expression defaults to `i32`. Decimal/exponent literals are `f32`. Integer tokens are bounded by `u64`; use `Int` conversions/operations for exact integer computation. Floating literals must be finite. Numeric overflow, inference and conversion rules are checked rather than inherited from JavaScript.

The full design draft's grammar also contains unsupported proposals. This section describes the current parser; [the parser source](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/core/src/syntax.rs) is the exact syntax authority for the linked revision.

## 21 Measuring performance

Measure complete returned results and matching semantics. Useful costs include construction, updates, queries, copying, memory, proof checking, compilation, migration and teardown. GPU uploads, dispatches and readbacks matter alongside kernel time.

The reports retain both gains and regressions. Beating a rescan does not establish an advantage over a handwritten maintained implementation. Passing conformance does not establish a performance improvement.

See [benchmark evidence](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/BENCHMARKS.md) and [measurement methodology](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/docs/benchmark-methodology.md) for recorded revisions, workloads and boundaries.

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

See [installation](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/docs/installation.md) and run `ink doctor` for available tools.

## 23 Current limits

Ink is a working prototype. Source execution, optimisation admission, target eligibility and profitability have separate coverage. General live strategy switching, schema evolution, an editor, richer source contracts and the wider design types remain unfinished.

The supported CPU language is broader than the shader subset. Mathematical admission does not prove backend correctness. Unsupported proof domains reject rather than accepting a theorem about a different program.

[Implementation status](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/STATUS.md) lists the published distribution's boundaries. [The plan](https://github.com/siliconjungle/ink-lang/blob/14524142b25e9de65f470ba2cbae84e500aecb5f/PLAN.md) records remaining acceptance work. The separate design draft describes ambitions and contains historical implementation overviews; it is not the supported-language reference.

## 24 Maintaining a total

For a table of `u64` weights, replacing a key changes a wrapping total by subtracting the old contribution and adding the new one. Treat an absent contribution as zero:

```text
new_total = old_total - previous_value + new_value
```

This is a schematic update equation, not an additional source API. To use it as a representation, the database must supply proofs connecting its initial value and every action to the declared keep, including deletion, abort and future updates.

Fixed-width totals use their wrapping arithmetic. Exact `Int` arithmetic has different semantics and a separate proof-admission boundary. Float sums cannot be repaired or reassociated with this equation merely because it looks algebraically familiar.

Correctness leaves a cost question: reads saved must pay for setup, extra writes, storage and migration. A simple recomputing implementation may win for a short session.

## 25 Execution and proof objects

The transaction model stages writes and events, commits a successful change once, and discards them on abort. Nested changes share that boundary. Queries and keeps observe the state appropriate to their caller; pending outbox events are distinct from delivery acknowledgements.

Pure equality concerns returned values in its admitted total domain. Allocation identity, exact fuel accounting and timing are not general observations of that equality. A resource-bounded execution can fail where an equivalent cheaper expression succeeds.

Stateful preservation includes results, errors, commit status, versions, logical state and ordered events across permitted future actions. It requires more than equal answers on sampled inputs.

The implemented proof formats and resource checks live in the [core](https://github.com/siliconjungle/ink-lang/tree/14524142b25e9de65f470ba2cbae84e500aecb5f/core). The richer dependent proof-term language and source tactics in the design draft are proposals. Tests and adversarial fixtures validate the implementation within their scope; they do not substitute for its mathematical admission obligations or prove the checker itself.
