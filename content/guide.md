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

`Json` is an ordinary recursive datatype from the pinned knowledge library. It supports arbitrary nested objects and arrays, exact numeric tokens, missing-versus-null lookup, updates and projection. General schema codecs also convert JSON into typed records and collections, rejecting invalid shapes and out-of-range numbers.

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

The portable binary format binds a declared schema and validates lengths, types and resource bounds. JavaScript binds validation and visitation operations to the immutable schema once, while retaining complete checks. Compiler-derived codecs can then materialize validated bytes with literal typed readers; runtime-defined schemas keep the generic decoder. Rust also offers borrowed validation without constructing a document tree. Networking stays outside Ink. Compiled calls currently materialize target values, and Wasm boundaries copy buffers; this is not a zero-copy or speedup claim. Dynamic JSON runs on CPU hosts.

JavaScript `callOwned` returns a detached logical result for callers using the same stable, well-typed inputs as a plain pure call. `ValueCodec.capture` validates and owns external logical values in one pass; `ValueCodec.copy` requires already valid values. Resource bounds apply to copying, and ordinary pure calls keep their existing sharing contract.

JavaScript also supplies `valueCodec.compact()` and `callCompact`. This optional transport omits the per-message schema hash and node frame lengths when both peers have already agreed on the exact schema identity and format. Type, Unicode, count and resource checks remain. Portable messages and state checkpoints retain their existing formats. The demo lets you try both transports.

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

The first command records the selected chain and search receipt. Frozen replay checks the proof packet without rediscovering it. More search can find better alternatives; it does not guarantee a global optimum. Missing comparable lifecycle measurements retains the baseline.

[Search, planning and physical strategies](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/database-planning.md)

## Learn from real usage

Optional recording captures call frequencies, input shapes, concurrency and lifecycle phases without storing input values. Publish those immutable observations, then compile again: planning discovers compatible recordings and uses measured complete-session costs across the observed cohorts. You do not have to invent query/update weights.

Proofs establish correctness. Profiles guide profitability. A past observation cannot establish a type invariant or predict every future request. Compiled resource plans can choose capacity reservations, checked final-use releases and admission credits. Runtime credit checks still handle future overload, rejecting with `INK_BACKPRESSURE` while preserving accepted-call order.

[Observed usage, proved properties and resources](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/proved-usage-planning.md)

## Split the work across targets

Eligible pure pipelines can combine **JavaScript, WebAssembly and WebGPU**. Saved target-bound cost profiles account for startup, data transfers and repeated use. Consecutive GPU stages can keep intermediates on the device. Stateful transactions execute on the host.

[Try a three-stage pipeline in the editor](./environment/): compile, run, then explicitly profile targets to see this browser's eligible placement. Ordinary Run does not perform profitability experiments. The editor's local placement profiles and the offline compiler's knowledge search are separate capabilities.

[How placement works](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/adaptive-execution.md)

## See what growing knowledge changes

The proof-growth study holds a compiler fixed and adds reusable law families to typed application kernels. At 16 families, the geometric-mean speedup is 2.17× against the zero-family baseline for the designed JavaScript inputs, and 2.39× for its actual AST/mesh input cohorts. Native and Wasm gains differ; the fused GPU alternative regresses on average. These chosen kernels are not an estimate for arbitrary unseen applications.

![Execution gains and regressions as reusable proof families grow](./proof-growth.svg)

The report separates complete-call timing, compiler improvements, database-only growth, compilation cost and forced alternatives. The practical aim is to remove work and let measurements reject losing choices.

[Sources, controls, costs and regressions](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/proof-growth-epoch3.md)

Fresh-process JavaScript lifecycle controls now include owned JSON trees, live
state with acknowledged events, and retained portable/compact document buffers.
The measured 32-document fixture retains about 3.82 MB of heap in Ink versus
0.79 MB in Frontier; the 4096-row state fixture retains about 3.24 MB versus
0.84 MB. These shared-host, forced-GC observations expose a datatype-storage
gap; they are not universal ratios or exact allocation counts. Import, first use,
construction and process peak memory are reported separately, and protocol
differences remain explicit.

[Matched lifecycle and footprint evidence](https://github.com/siliconjungle/ink-lang/blob/a6f49dc3eac9de296853b6a145f188649e508eac/reports/frontier-json-2026-10-13/README.md)

## What runs today

Ink supports typed state, atomic changes, ordered events, scalar retention, generics, owned buffers, pure computation and source specifications with proved implementations and invariants. Targets include C, Rust, JavaScript and both Wasm paths, plus eligible GPU work. Database knowledge supplies source algorithms, maintained queries, indexed/grouped representations and physical strategies under their individual admission contracts.

The standalone [editor repository](https://github.com/siliconjungle/ink-environment) contains the real browser compiler and execution environment. It supports single-file programs and explicit local target profiling. Linked imports, automatic external knowledge search and native Rust execution are outside that editor's current scope. Its exact compiler and package versions are linked below; language support, proof coverage and target eligibility remain distinct.

[Language reference](./reference.html) · [Implementation status](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/STATUS.md) · [Benchmark evidence](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/BENCHMARKS.md)

## Open source

Ink's compiler, optimisation knowledge, planner, lowerers, runtime, ABI, native support, editor, documentation site and Lean exporter are MIT licensed. Bundled dependencies, fonts and research data retain their own licences and notices.

[MIT license](./ink-license.txt) · [Language repository](https://github.com/siliconjungle/ink-lang) · [Editor repository](https://github.com/siliconjungle/ink-environment) · [Design and ambitions](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/vision.md)
