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

The planner finds applicable laws in the knowledge store and composes them through larger expressions. The semantic core checks each replacement and its conditions against the actual program.

```ink
fn advance(x: u32, step: u32) -> u32 {
    return repeat(10, x, fn(i) => fn(acc) => acc + step);
}

// A checked word-arithmetic law can replace the loop with:
// x + 10 * step
```

New laws can improve existing programs without adding optimisation cases to the compiler. Search is bounded; it keeps a valid candidate when the budget runs out. A proof establishes equivalence. A separate cost estimate or measurement decides whether to select it.

```sh
target/release/ink build totals.ink \
  --optimise knowledge/store/snapshot.json -o build/totals
```

Build plans record the selected transformations and proof dependencies. `--selection selection.json` replays a pinned plan without searching or reading the current database. [Selection and proof contract](https://github.com/siliconjungle/ink-lang/blob/main/docs/semantic-optimisation.md).

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

Import the module and call `functions.total([1, 2, 3])`; its `u64` result is `39n`. JavaScript preserves Ink's wrapping words, exact `u64` and `f32` rounding. It also supports exact integers, strings, IDs, Option/Result, tables, transactions and portable snapshots. Stateful modules export `createState()`. [JavaScript target](https://github.com/siliconjungle/ink-lang/blob/main/docs/javascript-backend.md).

Supported pure graphs can combine CPU and GPU stages. GPU pipelines can keep arrays resident across steps and iterations. Browser bundles compare eligible JavaScript, Wasm and WebGPU execution, including conversions, transfers and setup, and retain compiled CPU fallback. No target is always fastest.

GPU kernels support eligible flat 32-bit collection operations, including composed maps, filters, scans and integer sorts. Transactions and opaque values run on the CPU host. Resource limits can also select CPU, and GPU floats can differ from CPU results. Rendering is the host application's job. Read the [GPU compute contract](https://github.com/siliconjungle/ink-lang/blob/main/docs/gpu-compute.md) before choosing a target.

The [target parity contract](https://github.com/siliconjungle/ink-lang/blob/main/docs/lowering-parity.md) lists supported operations, host interfaces and validation. Complete C emission uses a shared Rust primitive runtime; it is not a freestanding C-only implementation.

## State and snapshots

A successful change commits its writes and ordered events together. A failed change rolls them back. Queries and maintained results must agree with the state they observe, including tentative writes inside a transaction.

C, Rust, JavaScript and Wasm share the same portable snapshot format for a checked program. Runtime adapters persist native C/Rust and compiled JavaScript or C/Rust Wasm state through synced files or IndexedDB in the browser. Native executables accept `--durable FILE`. They recover state and pending events before retrying calls; delivery is at least once, with receiver deduplication. [Durable host contract](https://github.com/siliconjungle/ink-lang/blob/main/docs/durable-host.md). General live migration and arbitrary program rewind remain future work. [State and host ABI](https://github.com/siliconjungle/ink-lang/blob/main/docs/wasm-abi.md).

## Knowledge and execution

The semantic core defines meaning and checks evidence. The distribution assembles independently pinned packages:

| Repository | Responsibility |
| --- | --- |
| [ink-knowledge](https://github.com/siliconjungle/ink-knowledge) | Immutable entries, snapshots, typed discovery and performance observations |
| [ink-planner](https://github.com/siliconjungle/ink-planner) | Search, applicability proofs and selection |
| [ink-runtime](https://github.com/siliconjungle/ink-runtime) | Execution, scheduling, profiling, bundle assembly and fallback |
| [Lowerings](https://github.com/siliconjungle/ink-lang/blob/main/docs/backend-packages.md) | Target emission and GPU device operations |

Entries have content identities, explicit kinds, semantics versions, typed interfaces and exact dependencies. SQLite is a rebuildable index; exported views authenticate selected entries against a pinned snapshot. Performance observations live separately and name their workload, hardware and toolchain. Storage and measurements never grant proof authority.

## Current scope

Ink is a working prototype. Pure rewrites compose today; specialised stateful proofs and implementations also exist. Live browser source editing, general stateful replacement, automatic migration, richer libraries and proof-authoring syntax remain unfinished. The checker, source correspondence, lowerers and physical adapters are trusted implementations; a checked rewrite is not a proof of the final machine code.

For the complete design, read the [language reference](%BASE_URL%reference.html) or download the [full draft](%BASE_URL%ink-specification.md). For implementation details, see [status](https://github.com/siliconjungle/ink-lang/blob/main/STATUS.md), [architecture](https://github.com/siliconjungle/ink-lang/blob/main/docs/repository-architecture.md) and [benchmark evidence](https://github.com/siliconjungle/ink-lang/blob/main/BENCHMARKS.md).
