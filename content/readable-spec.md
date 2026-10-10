## 1 How it works

Ink separates what a program means from how it runs. You describe data, changes and results. Checked proofs can justify a different algorithm or layout that preserves those results.

The core defines the language and checks evidence. A separate database stores reusable definitions, proofs and alternative implementations. Backend packages turn checked programs into executable code. Each can evolve independently.

One program should be able to use several targets: Wasm and WebGPU in a browser, or native CPU code and wgpu on desktop. Moving data, converting layouts and waiting for results cost time too. The goal is to optimise the whole execution plan, including those connections.

Proofs establish equivalence within a stated scope. Measurements help choose between valid implementations. An optimisation must remain correct when a profile changes; a network connection is not required to check downloaded knowledge.

The core, database and C/Rust/GPU/Wasm-adapter packages are separated today. Native, Wasm and a limited GPU subset run. General mixed-target routing is still being built.

## 2 An inventory program

This program stores inventory and keeps its total stock up to date. `state` holds data, `change` updates it, `query` reads it, and `keep` describes a result that depends on it.

```text
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

A successful change commits its writes and events together. Returning `Err` discards both. Queries see a consistent state. The compiler may recalculate the total or maintain it after each update; the answer must be identical.

## 3 Values and types

Types are checked before execution. Public declarations have explicit signatures; local bindings can use inference.

| Type family | Meaning |
| --- | --- |
| `Unit`, `Bool` | Unit value and Boolean values |
| `u8/u16/u32/u64`, `i8/i16/i32/i64` | Fixed-width integers |
| `Int`, `Nat` | Exact arbitrary-precision integers and nonnegative integers |
| `f32`, `f64` | Floating-point values with specified operations |
| `String`, `Bytes` | Immutable UTF-8 text and immutable bytes |
| `Option<T>`, `Result<T,E>` | Explicit absence and recoverable failure |
| `List<T>`, `Array<T,N>` | Ordered collections; an array has a static length |
| `Set<T>`, `Map<K,V>`, `Table<K,V>` | Finite collections with value semantics |
| Records and enums | Named product and tagged union types |
| `Id` declarations | Nominal 128-bit identifiers with no address semantics |
| `Buffer<T>` | An owned mutable temporary sequence |
| `Prop`, `Proof<P>` | Logical propositions and erased proof evidence |

Records describe values, not memory offsets. IDs stay stable when storage moves. A refinement adds a condition that must be proved or checked before a value is accepted.

```text
record Point {
    x: f64,
    y: f64,
}

enum Shape {
    Circle(Point, f64),
    Rectangle(Point, Point),
}

type SmallCount = { n: u32 where n <= 65535 };
```

Fixed-width `+`, `-` and `*` wrap on overflow. Use `checked_add`, `checked_sub` or `checked_mul` to return an error instead. `Int` and `Nat` use exact arithmetic. Numeric conversions are explicit; narrowing can fail.

Division and shifts use checked operations. Floating-point rewrites must preserve rounding, signed zero and infinities. Reassociation and approximate arithmetic need separate permission. They cannot be treated as exact equality.

## 4 Functions

A `fn` is pure: it receives its inputs and cannot read global state, perform I/O, use the clock or emit events.

```text
fn square(x: Int) -> Int {
    return x * x;
}

fn apply_twice<T>(f: fn(T) -> T, x: T) -> T {
    return f(f(x));
}
```

```text
fn sum_copy(xs: List<Int>) -> Int {
    var result = 0;
    for x in xs {
        result = result + x;
    }
    return result;
}
```

`let` binds an immutable value; `var` allows local reassignment. Calls evaluate eagerly, left to right. `&&` and `||` short-circuit. `?` propagates a `Result` error.

Total functions must terminate. Structural recursion or a proved decreasing measure establishes that. Unrestricted recursion and `while` require `partial fn`; partial functions cannot supply proofs or run inside initial transactions and maintained queries.

A uniquely owned `Buffer<T>` permits temporary mutation. Borrows cannot escape their owner or enter persistent state. Parallel execution requires evidence that the work is independent or its reduction law is valid.

## 5 State and changes

A `state` is a logical root. A `change` is an atomic transaction. `writes` permits reading and updating named roots, `reads` adds read-only access, and `emits` permits named event channels. Undeclared access is rejected.

```text
change(S, x) =
    Commit(S_next, result, ordered_events)
    or Abort(error)
```

Changes read their own tentative writes. A nested change shares its caller’s transaction; a nested error aborts the whole transaction. There are no independent nested commits or savepoints.

Table keys have a canonical order. `get` returns an optional value; `insert` requires absence and `replace` requires presence. Prove those conditions or use the fallible variants. `remove` returns the removed value when present.

Commits have increasing sequence numbers. A delta records changed keys and their before/after values, tied to a base version. Consecutive deltas can compose. Stale deltas conflict; merging replicas needs additional laws.

## 6 Keeping results up to date

`keep name: T = expression;` describes a result over state. It must be total and free of external effects. Dependencies cannot form cycles in the initial language.

The result behaves as if recalculated whenever read, including after tentative writes inside a change. An implementation may cache it, maintain it incrementally, or recompute it.

```text
maintain(Q(S), delta, auxiliary_state)
    produces Q(apply(S, delta))
```

Maintenance must preserve the right answer and the auxiliary invariant needed for every future update. Getting today’s answer right is insufficient.

Lists preserve order and duplicates. Table values follow canonical key order. A compiler may ignore order only when it proves that the result does not depend on it. The initial operators are `map`, `filter`, `sum` and `count`; grouping and joins come later.

## 7 Inputs and events

`event channel: Payload;` declares an output. `emit channel(value);` stages it inside a change. Events become visible, in order, after a successful commit.

Time, randomness and external responses enter as explicit inputs. Recording those inputs allows deterministic replay.

Hosts perform I/O and may store events in a durable outbox. Delivery can be retried; exactly-once external effects require the receiver’s cooperation. Storage failures and resource exhaustion remain explicit host concerns.

## 8 Proofs and contracts

Proofs use the language’s values, types and names. A theorem states a property; its proof must establish it. Proofs are erased when they do not determine runtime data.

```text
theorem int_add_zero(x: Int): x + 0 == x
    by normalize;

theorem swap_int_add(x: Int, y: Int): x + y == y + x
    by arithmetic;
```

```text
fn increment_small(x: u32) -> u32
    requires x < 100;
    ensures result == x + 1;
    ensures result <= 100;
{
    return x + 1;
}
```

`normalize` and `arithmetic` request proof search. They are not trusted shortcuts. Search must produce a certificate the checker accepts. A solver saying “valid” is insufficient.

Callers must establish `requires`; bodies must establish `ensures`. External inputs are validated. An unknown condition cannot be assumed because it held in previous runs.

The intended proof core uses dependent types, equality and inductive definitions. Its exact calculus remains to be specified. Tactics and AI may propose evidence; neither can approve it. Release proof packages cannot use `admit` or unchecked axioms.

## 9 What a proof guarantees

These are separate claims:

| Claim | Required evidence |
| --- | --- |
| Program properties | Proofs that selected contracts and invariants hold |
| Transformation correctness | Proofs that proposed implementations preserve the required semantics |
| Executable correctness | Evidence that lowering, code generation and relevant runtime behaviour preserve those semantics |

A checked rewrite does not verify LLVM, the runtime, system libraries or the host. A build must state its remaining trust boundary. The current prototype does not claim end-to-end verified machine code.

## 10 Writing optimisation rules

A rewrite gives two equivalent expressions and the evidence connecting them. Its parameters are universally quantified.

```text
rewrite add_zero(x: Int) {
    from x + 0;
    to x;
    proof by normalize;
}

rewrite map_fusion<A, B, C>(
    xs: List<A>,
    f: fn(A) -> B,
    g: fn(B) -> C
) {
    from xs.map(f).map(g);
    to xs.map(fn(x) => g(f(x)));
    proof by induction xs;
}
```

```text
implementation cached_sum for SumMachine {
    representation = CachedSumState;
    abstraction = cached_sum_relation;
    initialise = cached_sum_init;
    step = cached_sum_step;
    observe = cached_sum_observe;
    certificate = cached_sum_correct;
}
```

A `requires` condition must be established at each use. Substitution must preserve types, ownership and effects, without capturing variables.

An equality proves that an alternative is valid, not that it is faster. Representation changes and incremental algorithms need implementation packages with a simulation proof. The package names in this example are references to definitions, not built-ins.

## 11 Changing representations

A representation proof connects logical state to physical state. It must cover initialisation, query results, successful changes, errors, ordered events and all future permitted updates.

Abort must leave committed state and events unchanged. Caches must stay correct when queries observe tentative writes. Required termination behaviour must also agree.

Migration must preserve logical state, IDs, commit position, pending events and active readers. A fast direct migration needs the same evidence as decoding the old state and encoding the new one.

## 12 The knowledge database

The database stores immutable objects identified by their content. A compiler version and a knowledge snapshot can evolve independently.

| Object | Essential contents |
| --- | --- |
| Semantic definition | Canonical typed definition, dependency identities and semantics version |
| Theorem | Proposition, checked proof object, dependencies and allowed assumptions |
| Rewrite | Typed match pattern, alternative, side conditions and theorem reference |
| Implementation | Logical interface, physical representation, algorithms, abstraction relation and certificate |
| Measurement | Candidate identity, target, workload description, toolchain, metrics and uncertainty |
| Selection plan | Chosen implementations, discharged conditions, transformation chain and backend settings |

A hash identifies an object; it does not prove equivalence. Theorems depend on the exact definitions they reference. Names resolve through a lockfile to those identities.

Objects may come from local, project or shared stores. They are checked locally before use. Importing one does not authorise running its code during compilation.

Search retrieves a bounded, relevant set of candidates. More proofs provide more possibilities; redundant rules can also slow search. Database growth alone does not guarantee faster programs.

## 13 Choosing an implementation

Keep the baseline as a candidate. Search for alternatives, check their conditions, estimate costs, then measure promising choices.

The biggest gains come from skipping work, changing algorithms, maintaining results after updates, and reducing data movement or allocation. Vectorisation and instruction scheduling help with the work that remains.

The objective may be latency, throughput, memory or energy. Include proof checking, compilation, migration, guards, data transfers, layout conversion and synchronisation in the cost. A correct candidate that runs slower should stay unselected.

Search has time, memory and candidate limits. If it runs out of budget or cannot establish a proof, keep the best accepted implementation.

## 14 Changing implementations at runtime

Static mode chooses implementations before execution. Adaptive mode observes a bounded sample, proposes alternatives, checks their evidence, compiles and measures them, then migrates at a transaction boundary.

A profile is not a proof. Specialising for a property such as “values fit in 16 bits” needs a maintained bound or a guard with a correct fallback.

Trials use snapshots or synthetic inputs and cannot deliver real events. Switching back must preserve every committed user change. Cooldowns and migration budgets prevent constant switching.

## 15 Saving and restoring state

A snapshot stores logical state, program and schema identities, commit position, pending work and event-delivery metadata. It does not store raw machine addresses or arbitrary call stacks.

Checkpoints happen between transactions. Long-running durable tasks are explicit state machines whose progress lives in state.

The portable format is versioned and canonical: integers have fixed encodings, strings carry lengths, and tables use canonical key order. Decoding validates sizes, schemas and integrity. Physical caches may use other layouts.

A durable host commits deltas and events before acknowledging success. Recovery loads a checkpoint and replays later committed deltas. In-memory mode needs no mandatory disk I/O. Schema upgrades use explicit migration functions.

## 16 Code as data

Code, schemas, proofs and plans are typed objects with dependencies and history. Source files are the editable view of those objects.

An edit creates new identities. Incremental compilation follows the affected dependencies; existing proofs are reusable only with compatible definitions.

State and computation are connected through explicit changes and maintained results. This does not mean every data value is executable code. Initially, persistent callbacks use serialisable arguments and explicit state rather than arbitrary captured closures.

## 17 Compilation

The compiler and checker are written in Rust. Generated programs are not limited to the performance of the compiler’s implementation language.

Compilation checks source and proposed replacements before passing a checked program to a backend. The core checks meaning; backend packages handle target code and host protocols. The current compiler has its own restricted proof checker written in Rust. Lean is used for separate research proofs, not as a required compiler dependency.

The current bootstrap paths emit C or Rust and use LLVM for native and WebAssembly code generation. The build plan records selected transformations and their proof dependencies.

The baseline must already produce useful loops, calls and buffers. Foreign kernels have explicit interfaces and contracts; those contracts remain assumptions until independently justified.

## 18 Native code and WebAssembly

C and Rust backends use existing toolchains to produce native machine code or WebAssembly. A shared GPU backend emits WGSL and runs through WebGPU in a browser or wgpu on desktop. The current GPU subset handles u32 collection pipelines and retains compiled CPU fallback.

The intended host interface is:

```text
init(program_config_bytes) -> instance
apply(instance, change_id, encoded_arguments) -> encoded_result
query(instance, query_id, encoded_arguments) -> encoded_result
checkpoint(instance) -> encoded_snapshot
restore(encoded_snapshot) -> instance
drain_events(instance) -> encoded_events
close(instance)
```

The binary ABI must specify buffer ownership, lengths, validation and message versions. The current GPU runtime measures upload, allocation, dispatch and readback before choosing CPU or GPU per eligible function. Routing individual parts across targets, with checked physical bridges, remains implementation work.

Browser hosts provide storage and event adapters. Proof search can happen at build time; a browser does not need to ship an optimiser. The current implemented ABI is documented separately in the compiler repository.

## 19 Modules and commands

Imports are explicit. The prelude supplies built-in types and basic constructors and operators. Other names must be imported.

```text
module app.inventory;
import core.collections.{Table, List};
import core.arithmetic.{checked_add};
```

```text
ink check
ink prove
ink build --target native --mode static
ink build --target wasm --mode static
ink run --mode adaptive
ink explain total_units
ink knowledge import ./verified-package
ink knowledge verify
ink snapshot inspect ./checkpoint
ink benchmark ./workloads
```

The commands above are proposed interfaces. Manifests declare versions, targets, dependencies, trust policy and optimisation policy. Lockfiles pin object identities and toolchains.

A failed required contract fails the build. A failed optional optimisation keeps a valid baseline. `explain` reports what changed, why it was accepted, and what remains trusted. Reproducible builds also pin their selected plan.

## 20 Grammar

Source is UTF-8 with case-sensitive ASCII identifiers initially. Statements end in semicolons; braces delimit blocks. Comments use `//` or non-nesting `/* ... */`.

```text
module        = "module" path ";" { import | declaration } ;
import        = "import" path [ "." "{" name { "," name } "}" ] ";" ;

declaration   = [ "pub" ] (
                  id_decl | record_decl | enum_decl | alias_decl
                | fn_decl | state_decl | event_decl | keep_decl
                | query_decl | change_decl | theorem_decl
                | rewrite_decl | implementation_decl
                ) ;

id_decl       = "id" name ";" ;
record_decl   = "record" name [ generics ] "{"
                  { name ":" type "," } "}" ;
enum_decl     = "enum" name [ generics ] "{"
                  { name [ "(" type_list ")" ] "," } "}" ;
alias_decl    = "type" name [ generics ] "=" type ";" ;

fn_decl       = [ "partial" ] "fn" name [ generics ]
                  "(" parameters ")" "->" type
                  { contract } block ;
query_decl    = "query" name "(" parameters ")" "->" type
                  { capability } block ;
change_decl   = "change" name "(" parameters ")" "->" result_type
                  { capability } { contract } block ;

capability    = ("reads" | "writes" | "emits") "(" names ")" ;
contract      = ("requires" | "ensures") proposition ";" ;
state_decl    = "state" name ":" type "=" expression ";" ;
event_decl    = "event" name ":" type ";" ;
keep_decl     = "keep" name ":" type "=" expression ";" ;

theorem_decl  = "theorem" name [ generics ] "(" parameters ")"
                  ":" proposition "by" proof_script ";" ;
rewrite_decl  = "rewrite" name [ generics ] "(" parameters ")" "{"
                  { "requires" proposition ";" }
                  "from" expression ";"
                  "to" expression ";"
                  "proof" "by" proof_script ";" "}" ;
implementation_decl
              = "implementation" name "for" path "{"
                  "representation" "=" path ";"
                  "abstraction" "=" path ";"
                  "initialise" "=" path ";"
                  "step" "=" path ";"
                  "observe" "=" path ";"
                  "certificate" "=" path ";" "}" ;

block         = "{" { statement } "}" ;
statement     = ("let" | "var") name [ ":" type ] "=" expression ";"
              | lvalue "=" expression ";"
              | "return" expression ";"
              | "emit" name "(" expression ")" ";"
              | "if" expression block [ "else" block ]
              | "for" name "in" expression block
              | "while" expression block
              | expression ";" ;

type          = path [ "<" type_argument { "," type_argument } ">" ]
              | "fn" "(" type_list ")" "->" type
              | "{" name ":" type "where" proposition "}"
              | "(" type_list ")" ;
```

Expressions include literals, calls, fields, constructors, tuples, lists, lambdas, matching, operators and postfix `?`.

Precedence runs from calls and indexing through unary operators, multiplication, addition, comparisons, equality, `&&`, then `||`. Arithmetic associates left; chained comparisons are rejected. Parentheses override precedence.

Integer literals use an expected type or default to `Int`; floating literals default to `f64`. Out-of-range fixed-width literals are errors. The full parser grammar and proof-term encoding remain implementation work.

## 21 Measuring performance

Compare complete implementations with matching semantics against well-optimised C, C++ and Rust. Beating a naive rescan does not establish a language-wide performance lead.

Measure pure kernels, update/query mixes, changing distributions, small requests, large working sets, memory limits, native/Wasm execution and durability.

Report raw samples, variance, allocations, memory, compilation, proof checking and adaptation costs. Keep cold and warm results separate. Test unfamiliar workloads and distribution shifts.

“Fastest” is an ambition. A result is a measured advantage on a stated workload and machine.

## 22 Building the language

The work is staged. Each stage needs its own evidence.

| Stage | Deliverable | Acceptance condition |
| --- | --- | --- |
| Semantic baseline | Parser, type/effect checker, interpreter, tables and transactions | Executable examples have unambiguous results and abort/event behaviour |
| Proof core | Fixed logic, small kernel, theorem objects, contract checking | Invalid certificates and illicit assumptions are rejected |
| Static native compiler | Rust implementation, LLVM output, efficient baseline | Compiled and interpreted semantics agree on systematic validation suites |
| Initial knowledge store | Immutable rules, local import, pinned dependencies | Imported rules are checked and demonstrably change eligible compilation plans |
| Incremental execution | Proved sum/count maintenance and basic fusion | Certificates cover all supported update and error paths |
| Persistence and Wasm | Logical snapshots, recovery, host ABI, browser example | Native-to-Wasm state round trips preserve logical observations |
| Adaptive runtime | Profiling, bounded search, safe migration, rollback of implementation choice | Distribution shifts preserve behaviour and adaptation costs are measured |
| Expanded search | Representation synthesis, richer operators, shared registry | New knowledge improves selected workloads without widening the trust policy |
| Deeper verification | Lowering/runtime models and checked executable paths | Stronger claims are supported by an explicit end-to-end argument |

The first useful demonstration imports a checked package, changes a scan into maintained computation, preserves queries and events across future changes, and transfers a checkpoint between implementations. Compare it with a handwritten maintained baseline.

Tests, fuzzing and benchmarks are useful checks. They do not substitute for the proofs a verified mode promises.

## 23 What remains to decide

The draft still needs a precise proof calculus, complete grammar, canonical object encodings, general transaction simulation, durable storage protocols and stable host ABIs.

The prototype implements only part of this design. Its current status is documented in the compiler repository. The interpreter, checker and implementation packages should evolve together so semantic disagreements appear early.

## 24 Maintaining a total

A table holds exact integer weights. Replacing one row changes its total by subtracting the old value and adding the new one:

```text
sum_values(set(rows, k, v))
    == sum_values(rows) - old(rows, k) + v
```

```text
Logical state:
    rows

Physical state:
    rows
    cached_total

Abstraction relation:
    physical.rows == logical.rows
    physical.cached_total == sum_values(logical.rows)

Logical step set(k, v):
    rows := set(rows, k, v)

Physical step set(k, v):
    previous := old(rows, k)
    rows := set(rows, k, v)
    cached_total := cached_total - previous + v
```

```text
new_cached_total
    == old_sum - previous + v
    == sum_values(new_rows)
```

The cache relation says that the physical total equals the logical sum. The update equation preserves that relation. Initialisation, deletion, batches and abort need corresponding proofs.

The theorem covers arbitrary maps and values. Measurements decide when maintaining the cache is worthwhile. Using a machine integer instead of exact arithmetic needs a separate bound or checked fallback.

## 25 Execution and proof objects

The reference execution model makes transaction behaviour explicit:

```text
Begin(S):
    working := S
    events := []

Write(root, key, value):
    update working only

Read(root, key):
    read working for a change
    read the selected committed snapshot for a query

Emit(channel, value):
    append to staged events

Return Ok(value):
    commit working and events atomically
    return value with the new commit position

Return Err(error):
    discard working and events
    return error with the unchanged committed state
```

A nested change shares this working state and event list. Keeps read the same tentative or committed state as their reader.

Pure equivalence means equal results for every allowed input. State-machine equivalence also includes commit/abort results, commit positions and ordered events for every allowed input sequence. Layout, caches and ordinary timing are not public observations.

Proof objects use these general operations:

| Proof term | Purpose |
| --- | --- |
| Bound variable and theorem reference | Use a local premise or an exact dependency |
| Lambda and application | Introduce or eliminate a universally quantified statement or implication |
| Constructor and eliminator | Build and reason about an inductive type |
| Equality reflexivity and transport | Establish definitional equality and replace equals |
| Universe and dependent function | Describe typed quantification |
| Verified decision certificate | Invoke a specified checker whose soundness theorem connects its accepted certificate to the proposition |

Proof scripts produce those objects; their names alone establish nothing.

```text
proof_script = tactic { "," tactic } ;
tactic       = "normalize"
             | "arithmetic"
             | "intro" names
             | "exact" proof_expression
             | "apply" path
             | "rewrite" path
             | "cases" name
             | "induction" name ;
```

Unsupported certificates are rejected. Optional optimisations retain the baseline. The checker itself remains a trusted implementation until its correctness is established separately.
