## Philosophy

**Keep program meaning stable; let implementation knowledge accumulate.**

Describe the required computation and permitted changes. Make better ways to execute them reusable across programs. Proofs establish which alternatives preserve meaning; measurements guide which are worthwhile. The semantic core defines and checks meaning, while independently versioned knowledge grows the repertoire of implementations.

Useful progress means less work and better complete execution on real workloads. It includes the costs of search, setup, copying, maintenance, migration and teardown. A correct alternative that loses on a workload should remain optional. Read [the philosophy and ambitions](https://github.com/siliconjungle/ink-lang/blob/main/docs/vision.md).

## Get started

Build the compiler with Rust:

```sh
git clone --recurse-submodules https://github.com/siliconjungle/ink-lang.git
cd ink-lang
cargo build --release
```

Save the example above as [totals.ink](%BASE_URL%totals.ink), then run it:

```sh
printf '[[1, 2, 3]]\n' > arguments.json
target/release/ink run totals.ink total arguments.json
```

The result is `39`. The argument file contains one list for the function's one parameter. Native and Wasm builds use existing C/Rust toolchains; optimisation search also needs Python.

For a relocatable installation with pinned optional tools, use `python3 tools/install.py --prefix DIRECTORY`. `ink doctor` reports tool availability; `ink explain SOURCE` shows checked types, effects and optimisation plans. [Installation and inspection](https://github.com/siliconjungle/ink-lang/blob/main/docs/installation.md).

## What you can write

Pure functions handle collections, word arithmetic, `i32`, `f32`, vectors, records and bounded loops. They suit data transforms, aggregates and particle simulation steps:

```ink
fn kick(vs: List<Vec3<f32>>, dt: f32,
        gravity: Vec3<f32>) -> List<Vec3<f32>> {
    return vs.map(fn(v) => vec3(
        v.x + gravity.x * dt,
        v.y + gravity.y * dt,
        v.z + gravity.z * dt
    ));
}
```

Stateful programs add typed tables, queries, atomic changes, events and maintained results. They suit inventory, counters and other application logic. External I/O belongs to the host. See the [particle example](https://github.com/siliconjungle/ink-lang/blob/main/examples/particles.ink) and [state examples](https://github.com/siliconjungle/ink-lang/blob/main/docs/wasm-abi.md).

## Modules

Split programs into explicit source imports. Functions, types, state and events keep their own module namespace:

```ink
module example;
import "std:words" as words;
fn bounded(x: u32) -> u32 { return words.clamp32(x, 0, 100); }
```

Relative file imports use `import "stock.ink" as stock;`. The compiler ships small word/list helper modules and checks the linked program before lowering. [Modules and library helpers](https://github.com/siliconjungle/ink-lang/blob/main/docs/modules.md).

## How optimisation works

The planner finds applicable laws in the knowledge store and composes them through larger expressions, including eligible pure expressions inside queries, changes and maintained results. The semantic core checks each replacement and its conditions against the actual program; reads, writes, calls and error handling remain outside this rewrite path.

```ink
fn advance(x: u32, step: u32) -> u32 {
    return repeat(10, x, fn(i) => fn(acc) => acc + step);
}

// A checked word-arithmetic law can replace the loop with:
// x + 10 * step
```

New laws can improve existing programs without adding optimisation cases to the compiler. Search is bounded; it keeps a valid candidate when the budget runs out. A proof establishes equivalence. A separate cost estimate or measurement decides whether to select it.

This machinery goes beyond storing proof files. Entries have typed interfaces, explicit application conditions and exact dependencies, so the planner can discover and reuse them. Canonical knowledge is stored as immutable JSON files and snapshots, with a rebuildable SQLite discovery index. Storage itself grants no mathematical authority.

```sh
target/release/ink build totals.ink \
  --optimise knowledge/store/snapshot.json -o build/totals
```

Build plans record the selected transformations and proof dependencies. `--selection selection.json` replays a pinned plan without searching or reading the current database. [Selection and proof contract](https://github.com/siliconjungle/ink-lang/blob/main/docs/semantic-optimisation.md).

Whole-action proofs can also replace a complete action in a restricted domain. For example, a database law can reduce two removals of the same key to one, while preserving replies, every table, rollback, versions and ordered events. These proofs cover every initial state and argument; the compiler checks the proposed alternative against the actual source. [Whole-action contract and limits](https://github.com/siliconjungle/ink-lang/blob/main/docs/action-transitions.md).

## Implementations as knowledge

The store can also supply physical state layouts, cached-query implementations and migration bridges. The core checks encoding, decoding, observations and invariant preservation for every source action. The current admission domain is restricted; physical definitions execute through the Rust backend. Checked bridges allow explicit switches at transaction boundaries while retaining portable logical snapshots. [Representation contract](https://github.com/siliconjungle/ink-lang/blob/main/docs/database-representations.md).

Fixed-key queries now have checked delta maintenance for supported remove/replace chains, with refresh fallback for unsupported updates. Existing owned Buffer/Map operations and loops also have broader logical correspondence and 215 database laws. An external representation selector charges lifecycle phases, action counts, memory and exact migration costs. Its small-fixture profile selects direct lookup because the delta cache loses on complete costs. [Owned laws](https://github.com/siliconjungle/ink-lang/blob/main/docs/owned-optimisation.md) · [Point-delta contract](https://github.com/siliconjungle/ink-lang/blob/main/docs/point-query-delta.md) · [Lifecycle evidence](https://github.com/siliconjungle/ink-lang/blob/main/reports/incremental-maintenance-selection/README.md).

The broader ambition is to repair only affected results after changes, select indexes or caches using operation frequencies and lifetime, and choose execution targets using size and residency. Exact change information can establish that a cached answer remains valid. A historical pattern only helps estimate whether caching will pay. General live strategy control remains work in progress.

## Where it runs

| Target | Execution path |
| --- | --- |
| Native CPU | Generated C or Rust, compiled with existing toolchains |
| Browser CPU | JavaScript ES modules or WebAssembly |
| GPU | WGSL through browser WebGPU or native wgpu |

Pure and stateful programs compile to JavaScript:

```sh
target/release/ink build totals.ink --target javascript -o totals.mjs
```

Import the module and call `functions.total([1n, 2n, 3n])`; its `u64` result is `39n`. Direct JavaScript calls use BigInt values for `u64` parameters and elements. JavaScript preserves Ink's wrapping words, exact `u64` and `f32` rounding. It also supports exact integers, strings, IDs, Option/Result, tables, transactions and portable snapshots. Stateful modules export `createState()`. [JavaScript target](https://github.com/siliconjungle/ink-lang/blob/main/docs/javascript-backend.md).

Supported pure graphs can combine CPU and GPU stages. GPU pipelines can keep arrays resident across steps and iterations. Browser bundles compare eligible JavaScript, Wasm and WebGPU execution, including conversions, transfers and setup, and retain compiled CPU fallback. No target is always fastest.

GPU kernels support eligible flat 32-bit collection operations, including composed maps, filters, scans and integer sorts. Transactions and opaque values run on the CPU host. Resource limits can also select CPU, and GPU floats can differ from CPU results. Rendering is the host application's job. Read the [GPU compute contract](https://github.com/siliconjungle/ink-lang/blob/main/docs/gpu-compute.md) before choosing a target.

The [target parity contract](https://github.com/siliconjungle/ink-lang/blob/main/docs/lowering-parity.md) lists supported operations, host interfaces and validation. Complete C emission uses a shared Rust primitive runtime; it is not a freestanding C-only implementation.

## State and snapshots

A successful change commits its writes and ordered events together. A failed change rolls them back. Queries and maintained results must agree with the state they observe, including tentative writes inside a transaction.

C, Rust, JavaScript and Wasm share the same portable snapshot format for a checked program. Checked optimisation plans preserve the original program’s checkpoint identity, so state and durable files can move between its baseline and optimised builds. This requires the checked selection witness; independently emitted modified programs keep their own identities. [Selected checkpoint contract](https://github.com/siliconjungle/ink-lang/blob/main/docs/selected-checkpoints.md).

Runtime adapters persist native C/Rust and compiled JavaScript or C/Rust Wasm state through synced files or IndexedDB in the browser. Native executables accept `--durable FILE`. They recover state and pending events before retrying calls; delivery is at least once, with receiver deduplication. [Durable host contract](https://github.com/siliconjungle/ink-lang/blob/main/docs/durable-host.md). General live migration and arbitrary program rewind remain future work. [State and host ABI](https://github.com/siliconjungle/ink-lang/blob/main/docs/wasm-abi.md).

Existing `i32`, `f32` and fixed numerical vectors also cross tables, actions, keeps, events and checkpoints on CPU targets. Stored float-bit identity and scalar IEEE comparisons are distinct contracts; numerical execution support does not automatically extend the stateful replacement proof domain. [Numerical state](https://github.com/siliconjungle/ink-lang/blob/main/docs/numerical-state.md).

## Knowledge and execution

The semantic core defines meaning and checks evidence. The distribution assembles independently pinned packages:

| Repository | Responsibility |
| --- | --- |
| [ink-knowledge](https://github.com/siliconjungle/ink-knowledge) | Immutable entries, snapshots, typed discovery and performance observations |
| [ink-planner](https://github.com/siliconjungle/ink-planner) | Search, applicability proofs and selection |
| [ink-runtime](https://github.com/siliconjungle/ink-runtime) | Execution, scheduling, profiling, bundle assembly and fallback |
| [Lowerings](https://github.com/siliconjungle/ink-lang/blob/main/docs/backend-packages.md) | Target emission and GPU device operations |

Entries have content identities, explicit kinds, semantics versions, typed interfaces and exact dependencies. SQLite is a rebuildable index; exported views authenticate selected entries against a pinned snapshot. Performance observations live separately and name their workload, hardware and toolchain. Storage and measurements never grant proof authority.

## Performance and direction

Recent database-only laws remove traversals, intermediate collections and redundant GPU stages with the production compiler unchanged. Many measured cases improve over earlier Ink; others regress. Strong handwritten Rust and JavaScript controls often remain faster, and complete GPU requests can lose even after dispatch counts fall. Resident execution and full requests need separate measurements. [Benchmark evidence](https://github.com/siliconjungle/ink-lang/blob/main/BENCHMARKS.md).

Current work carries useful facts through composition into memory lowering, attributes setup and complete-state transport costs, tests broader incremental workloads, and improves target-specific profitability. Parallel work, owned partitions, guarded recursion and an additional bounded Lean verdict are also being integrated. Their scope and release state are tracked in [implementation status](https://github.com/siliconjungle/ink-lang/blob/main/STATUS.md).

The goal is reusable improvements on unfamiliar programs and competitive complete execution on specified hardware. A larger catalogue, a smaller expression or a valid proof alone does not demonstrate faster execution. [Acceptance gates](https://github.com/siliconjungle/ink-lang/blob/main/PLAN.md).

## Current scope

Ink is a working prototype. Expression rewrites compose in supported pure functions and action regions; whole-action and physical-representation admission cover restricted domains. CPU numerical state and explicit checked migrations work today. Broader correspondence, efficient physical execution, general live adaptation, richer libraries and proof-authoring syntax remain unfinished. Editor support and schema evolution are outside the current acceptance scope.

The Rust checker, source correspondence, lowerers, codecs, hosts and toolchains remain trusted implementations. Lean research proves specified models or separate calculi; it does not verify the complete compiler. A checked transformation is not an end-to-end proof of the final machine code.

For the complete design, read the [language reference](%BASE_URL%reference.html) or download the [full draft](%BASE_URL%ink-specification.md). For implementation details, see [status](https://github.com/siliconjungle/ink-lang/blob/main/STATUS.md), [architecture](https://github.com/siliconjungle/ink-lang/blob/main/docs/repository-architecture.md) and [benchmark evidence](https://github.com/siliconjungle/ink-lang/blob/main/BENCHMARKS.md).
