## Read the comparisons

Every result needs a baseline. Adding knowledge to a fixed compiler, improving the compiler itself and comparing with another library answer different questions. Their speedup factors should not be multiplied together.

The results below retain separate published experiments from 13–15 October 2026. Each report retains its acquired source revisions, inputs and controls. Updating the documentation or planner does not rerun those experiments.

## Ordered query expressions

The first ordered-query milestone compares query syntax, ordinary Ink pipelines/loops and handwritten Rust/JavaScript controls. The following held-out times are microseconds per complete warm call including output consumption, using three fresh processes and eleven samples per process on one macOS arm64 host.

| Workload | Query | Ordinary Ink pipeline/loop | Handwritten target control |
| --- | ---: | ---: | ---: |
| Rust filter, 4096 rows / broad result | 5.526 | 5.757 | 5.454 |
| Rust filter, 4096 rows / selective | 3.114 | 3.435 | 2.201 |
| Rust existence, first of 4096 | 0.198 | 0.197 | 0.004 |
| Rust join, 256 × 256 | 24.760 | 36.946 | 21.414 |
| JS filter, 4096 rows / broad result | 25.988 | 26.061 | 23.789 |
| JS join, 256 × 256 | 91.369 | 131.806 | 54.413 |

The broad filter is close to the ordinary pipeline and handwritten Rust. Selective filters, joins and native early-exit calls retain material gaps. Native Ink typed calls own their input vectors and include cloning reusable caller data; handwritten Rust borrows slices. The existence comparison therefore exposes a storage/call-boundary cost as well as traversal. JavaScript compares exported trusted calls with direct handwritten functions. The report retains empty/small cases and all raw samples; these timings are not a universal speed claim or an automatic selection decision.

Cross-target conformance separately checks 113 values, outcomes and exact snapshots, including 19 actual eligible wgpu calls. It does not establish a GPU speedup. The milestone adds no database pushdown or index/hash-join selection.

[Exact source, controls, raw samples and limits](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/reports/ordered-query-expressions-2026-10-15/README.md)

## Matched Handwired searches

On an Apple M4 Pro with Chrome 155, an explicitly authored packed Ink literal
matcher returns complete counts for 100,000 documents in 3.6–3.8 ms in warm
resident-GPU calls. Handwired's public search API takes 12.4–13.5 ms for the same
three literals across development and held-out corpora: a 3.3–3.6× difference.
The earlier Ink DFA takes 4.5–5.1 ms under the same protocol, so packing itself
accounts for a smaller 1.2–1.3× improvement. Parameters, dispatch, readback and
complete output consumption are timed; initial encoding and setup are separate.

This is a specialized literal algorithm compared with a richer regex engine,
not a general regex or neural-execution win. Three page loads per large corpus
share one browser process. Paused GPU requests are slower, small inputs favor
CPU execution, and a comparable end-to-end first-call result remains open.
Allocation-free UTF-8 reads improve this Ink JavaScript pipeline by 5.9–8.7×,
while it still loses to native JavaScript search. The owning native Rust API
also remains slower than the handwritten borrowed control.

Independent complete-output checks cover both large corpora and size controls.
Separate conformance checks cover 128 library cases across reference, Rust,
JavaScript and Rust-Wasm, including 48 actual eligible wgpu calls. Eight scalar
proofs establish components, rather than correctness of the entire matcher or
compiler. The separate conditional-fact experiment below measures initial
Freerange-inspired inference; Pretext-inspired gains remain open.

[Raw samples, reproducer, controls and limits](https://github.com/siliconjungle/ink-lang/blob/a0a4fa0ff7f24e74ab99a6f98b6b86f31458e702/reports/handwired-packed-circuits-2026-10-15/README.md) · [Broader contracts and preparation work](./guide.html#infer-facts-and-prepare-repeated-work)

## Automatic derivatives and prepared context

Whole-objective gradients execute through pure helper functions, structured
numeric state and bounded rollouts. Full gradients now carry all basis directions
through one primal pass. Tangent work still scales with parameter count. Generic
JavaScript local scalar-record storage and F32 carrier bookkeeping reduce overhead
without reassociation, discarded zero-times-infinity arithmetic or approximation.

| Warm complete JavaScript call | Previous full gradient | Batched gradient | Repeated JVPs | Handwritten |
| --- | ---: | ---: | ---: | ---: |
| 0 context values | 5.218 µs | 2.784 µs | 1.815 µs | 0.579 µs |
| 16 context values | 7.246 µs | 4.542 µs | 8.330 µs | 0.663 µs |
| 4096 context values | 1.356 ms | 0.780 ms | 1.556 ms | 0.109 ms |
| 32768 context values | 18.779 ms | 8.985 ms | 22.297 ms | 1.000 ms |

These held-out medians use three fresh processes, eleven randomly interleaved
samples per process, an independent polynomial derivative oracle and complete
output consumption. Both compiler versions run on identical inputs in each process
on an Apple M4 Pro with Node 22.22.1. Preparation is included; no context survives
across calls. The previous emitted module is frozen from the earlier delivery.
[Raw samples, modules, source and reproduction](https://github.com/siliconjungle/ink-lang/blob/d8005a095fe0e560b51df127610991b0980b89e4/bench/batched-differentiation/README.md).

This improves the large gradient 2.09×. Separate JVPs remain cheaper for empty
input, and the authored derivative remains about 9× faster at the largest size.
It is one designed workload, not broad neural-training performance, Handwired
parity, first-call latency, peak-memory evidence or GPU-training speed. The
[initial preparation comparison](https://github.com/siliconjungle/ink-lang/blob/15d360d477158a0da314776279724018f759c928/bench/differentiable-preparation/README.md)
retains the earlier small-input regressions.

Two ordinary database equations universally compare batched and separate-direction
results for specific polynomial/nonlinear kernels in their exact definition
contexts. Source application rejects stale contexts even after a source-hash
refresh. These compare generated implementations; they do not prove the general
AD formulas, checker or backends correct.

Local acceptance covers 105 cross-target values/outcomes and exact snapshots,
including five actual GPU calls across four scenarios. Those include a twelve-step
trajectory gradient and an implementation selected using the new proof. Stateful
learning remains on the host. [Acceptance receipts and scope](https://github.com/siliconjungle/ink-lang/blob/d8005a095fe0e560b51df127610991b0980b89e4/reports/batched-differentiation-2026-10-15/README.md).

## Prepared numeric tables

A Pretext-inspired proposal prepares a numeric table once outside a map when it
does not depend on the current item. Whole-function equality proofs, including an
empty-input guard, are checked before selection. This is a preparation mechanism;
full Unicode/browser text-layout parity remains open.

| Complete JavaScript call | Before | Selected |
| --- | ---: | ---: |
| 512 indices, 256 table values | 147.208 µs | 1.291 µs |
| 32 indices, 16 table values | 1.383 µs | 2.143 µs |

These held-out results are medians of three fresh Node processes, each with eleven
paired samples, including preparation and full output consumption. They use designed
workloads, no retained cache across calls, and an independent direct lookup oracle.
The small-case regression is a reason to retain profitability gates. They do not
measure browser layout or cold first-call latency. [Raw receipts and procedure](https://github.com/siliconjungle/ink-lang/blob/bc9ff59e49766908968dfb91a54ceb7652cd775b/bench/prepared-tables/README.md).

Required-target checks compare 94 cases across Rust, JavaScript and Wasm, including
exceptional F32 values. GPU-host comparison uses CPU fallback for these cases;
it does not establish device preparation support. [Full verification logs](https://github.com/siliconjungle/ink-lang/blob/bc9ff59e49766908968dfb91a54ceb7652cd775b/reports/prepared-tables-2026-10-15).

## Conditional unsigned facts

The first Freerange-inspired addition extends Ink's existing unsigned analyser
with excluded values and relational range refinement. Offline acquisition proves
four complete source equalities before publishing them into the normal database
catalogue. Independent value tests and 88 compiled conformance cases include one
actual eligible GPU call.

On an Apple M4 Pro with Node 22.22.1, the held-out boundary-distribution batch of
65,536 relational-mask calls takes 0.788 ms before and 0.459 ms after the proved
replacement. Two U64 guard batches take about 1.11 ms before and 0.40 ms after.
The mapped-list case changes from 0.165 to 0.155 ms. Three fresh processes per
cohort retain eleven paired samples each, full output checks and every consumed
result. Other distributions show smaller changes, and unchanged controls include
small regressions. These are designed mechanism workloads; proof acquisition and
compilation are excluded, and broad application gains remain unestablished.

[Raw samples, source, proof receipts and limits](https://github.com/siliconjungle/ink-lang/blob/452b7f908d51c56bae00ff66986cc98dcc27a80a/reports/conditional-facts-2026-10-15/README.md)

## Compiler and planner

The frozen planning corpus contains ten programs. Selection uses development inputs; evaluation uses 24 separate inputs per program spanning sizes and distributions. The JavaScript harness uses paired, interleaved timing and checks the outputs.

| Comparison | Published result | What changed |
| --- | --- | --- |
| Updated compiler and selected plan versus previous default | 1.73× geometric-mean speedup across ten programs | Compiler improvements and planning together |
| Selected plan versus the same compiler's baseline | 1.29× geometric-mean speedup | Five of ten programs select alternatives |
| Incremental-distinct versus previous default | 10.02× geometric-mean speedup | Ownership-based in-place appends, with the baseline still selected |

These averages include regressions. The same-compiler comparison reports 39 robust gains and eight robust losses across its evaluation cells. Small compact-set inputs lose despite gains at larger sizes, and sequence-every shows a small overall regression. The corpus is ten small programs on one JavaScript host, not a forecast for arbitrary applications.

[Corpus protocol, per-program results and regressions](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/bench/planning-corpus/results-measured-2026-10-13.md) · [Ownership analysis and in-place appends](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/in-place-reuse.md)

## Knowledge with the compiler fixed

The separate proof-growth experiment adds reusable law families without changing the compiler during the study. At 16 families it reports 2.17× geometric-mean speedup on designed JavaScript inputs and 2.39× on its actual AST/mesh cohorts, relative to zero families.

![Execution gains and regressions as reusable proof families grow](./proof-growth.svg)

Native Rust and Rust-Wasm ratios are 1.10× and 1.08× at that checkpoint. The fused GPU cohort is 0.79× and therefore slower on average. These are selected kernels with their stated boundaries; entry count alone does not predict useful optimisation coverage.

[Fixed-compiler sources, controls and costs](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/proof-growth-epoch3.md)

## JSON and state

An earlier compact-construction release compares separate boundaries against Frontier. Results are medians of three fresh-process medians on a shared Node 26.1 / Apple M2 host, with complete-output preflight and rotated timing rounds. Time is in microseconds per call; lower is better.

| Boundary | Ink | Frontier | Comparison |
| --- | --- | --- | --- |
| Detached result from stable prepared logical inputs | 53.030 | 97.791 | Ink 1.84× faster |
| Compact message encode | 0.464 | 0.654 | Ink 1.41× faster |
| Portable message encode | 0.645 | 0.654 | Approximately tied |
| Compact message decode | 0.783 | 0.605 | Ink takes 1.29× longer |
| Portable message decode | 1.318 | 0.605 | Ink takes 2.18× longer |
| 4096-row replacement | 2.559 | 0.718 | Ink takes 3.56× longer |
| Prepared replacement, preparation excluded for both | 0.771 | 0.446 | Ink takes 1.73× longer |
| Text to known edit to text | 360.424 | 80.016 | Ink takes 4.50× longer |

Compact messages require prior agreement on the exact schema and format; portable messages identify their schema. The detached-result lane uses stable, well-typed inputs. Ink's checked external-input path includes additional validation and is measured separately. Exact numeric tokens, member order, ownership and protocol differences remain part of the comparison.

Direct compact construction improves Ink's complete 32-document initialization phase by 1.51× against logical parse/encode, but still takes 1.81× longer than its corresponding Frontier control. Earlier retained-edit and indexed-query wins are different boundaries; the indexed implementation is explicitly supplied rather than automatically selected. Ink has not achieved an all-metrics win.

[Exact releases, harnesses, samples and boundary definitions](https://github.com/siliconjungle/ink-lang/blob/8c2471e6b9f0dbb5f051971f55b394912c7b5bbc/reports/frontier-json-2026-10-13/README.md)

## Startup and memory

Retaining 32 owned 512-field JSON trees measured about 3.82 MB of GC heap in Ink versus 0.79 MB in Frontier. A 4096-row live-state fixture with acknowledged events measured about 3.24 MB versus 0.84 MB. These show remaining storage costs even where individual operations are faster.

Imports, construction, first use, retained buffers and process peak memory are recorded separately. Forced-GC heap deltas on a shared host are diagnostic observations, not exact allocation counts or universal memory bounds. Compare complete lifecycles before choosing a representation.

[Matched lifecycle and footprint controls](https://github.com/siliconjungle/ink-lang/blob/a6f49dc3eac9de296853b6a145f188649e508eac/reports/frontier-json-2026-10-13/README.md)

## Selection policy

Proof admission, target eligibility and profitability are separate gates. An implementation must preserve the required meaning and be executable on the target before cost evidence can select it. Missing comparable lifecycle evidence keeps selection on the baseline, including plans made only of checked maintained folds. The former asymptotic-only exception is removed: equal asymptotic write cost does not establish better setup costs, latency, memory or migration. Automatic selection needs comparable lifecycle evidence or an admitted validated work model.

The work-model path is an explicit experimental option in the Python compiled planner. Supply both `--work-model` and `--work-workload` to enable it. It can predict gains when ordinary selection lacks comparable evidence; it does not override a timing-based decision. Its current held-out study selected one of ten programs, with a 1.53× gain for that program. The reference-fuel model was rejected. This is narrow evidence, not established general prediction.

Current planner safeguards include:

- Average work per phase before applying lifecycle frequencies, so extra sample inputs do not silently alter the workload mix.
- Bind both model and workload contents into the compiled-plan cache key; replay the selected proof chain on a cache hit.
- Retain the baseline when a memory limit or nonzero migration count needs evidence the work model does not provide.
- Keep model selection opt-in and report the decision separately from measured speedups.

[Work-model protocol and held-out results](https://github.com/siliconjungle/ink-planner/blob/5dd9523c5f5b97df517c12b610d5ba126dc785cf/docs/work-model.md) · [Selection reference](./reference.html#chapter-13)

## Research under evaluation

A checked physical plan can now remove single-field record wrappers in compiled JavaScript. In three fresh-process cohorts, the selected 4,096-row state retains 2.33 MB versus ordinary Ink’s 3.24 MB: 28.3% less heap. Replacement takes 2.32 µs versus 2.85 µs, an 18.4% reduction. Frontier still wins at approximately 0.7 µs and 0.84 MB. Public JSON trees keep their logical format and do not gain this memory reduction.

Selecting the layout across the whole module makes logical JSON calls slower because they convert inputs and reconstruct outputs. Detached edits take 328 µs with elision versus 37 µs with ordinary Ink and 101 µs with Frontier. The previous Ink release rerun also takes about 36 µs, so the older 53-to-37 µs comparison does not establish a new compiler speedup. These are explicit alternatives, not an unconditional default. Private captured-value and wire boundaries are now supported; their separate measurements appear below.

Earlier flattened-sum, tagged-word and dictionary probes remain isolated carrier experiments. They do not establish compiled action or transaction performance. The measured modules precede the concurrent JavaScript object-adapter addition; reports retain their exact bytes and scope.

The native proof-authoring path now offers an explicit `shared-v2` Boolean circuit encoding alongside the unchanged default `literal-v1`. A representative obligation shrinks from 78,828 clauses to 1,763. This reduces proof construction costs; it does not establish a compiled-program speedup or authorise a new datatype layout. The report also records two baseline hardening-test failures that remain open.

[Compiled layouts, experiments and limits](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/reports/frontier-json-2026-10-13/README.md#compiled-record-elision-217237) · [Shared circuits, trust scope and open tests](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/shared-bit-circuits.md)

## Captured private values

The compiled JavaScript module now offers typed opaque handles through `compiledValues` and `callCompiled`. Capture validates and owns the input once; subsequent calls retain the private representation. Materialize an owned public value only when needed, or encode the handle directly for transport. Binary calls also use literal private readers and writers. These boundaries apply to general first-order Ink values.

The archived fused-capture cohort compares exact previous and fused-capture modules with the same source, physical plan, ABI and benchmark. Three fresh processes per implementation alternate on the shared Node 26.1 / Apple M2 host. These figures do not represent a fresh run of every later compiler revision.

| Boundary | Previous Ink µs | Fused-capture Ink µs | Paired Frontier µs |
| --- | ---: | ---: | ---: |
| Warm capture of three typed arguments | 580.693 | 89.770 | 23.159 (document clone only) |
| Capture, edit and detached owned output | 616.112 | 124.542 | 126.854 |
| Prepared edit and detached owned output | 36.139 | 36.482 | 103.290 |

Literal validation, ownership and private conversion now run in one traversal, making warm capture **6.47× faster** and the capture/edit/output lifecycle **4.95× faster** than the paired previous module. Prepared owned execution is **2.83× faster** than Frontier. The fresh-input lifecycle is close to Frontier on this fixture; its small difference is not a robust win. Ink validates its typed logical input while Frontier clones a native document without matching validation, and neither ingress lane includes JSON parsing.

Cold codec construction takes 571 → 418 µs; first capture after construction takes 2,660 → 1,619 µs. Cold import takes 11.1 → 11.9 ms with additional literal helper code. These are separate single observations per process, aggregated across three processes. Earlier initial-capture figures included lazy codec construction and should not be pooled with this split. Private-only or encoded outputs remain different boundaries, with no matched Frontier win claimed.

That archived layout measured a full binary text pipeline of 797.950 µs and a logical text pipeline of 830.311 µs. Later cohorts below use different output paths and controls; absolute timings across epochs do not establish causal speedups. The end-to-end Frontier goal remains open. Workload profiles must account for setup, reuse, retained memory and the chosen output boundary.

The frozen ten-program quick corpus compiles all programs and admits alternatives for seven, but selects none at the default evidence gates. Quick budgets defer the new layout family. Interleaving recipe stages and allowing the balanced budget discovers two record-layout proposals and admits them on the unchanged `compact-set` program; this proves discovery and admission, not profitability.

## Recent matched state controls

Three fresh processes and nine rotated rounds compare 4,096-row replacements with complete replies, versions, ordered events, acknowledgement and exact Ink checkpoints. The ordinary protocol control retains the same admitted record/sum layouts and preflight actions. Values below are medians of process medians, in microseconds per call.

| Boundary | Ink | Frontier main | Interpretation |
| --- | ---: | ---: | --- |
| Ordinary replacement | 2.817 | 1.224 | Ink takes about 2.3× longer |
| Prepared replacement | 0.919 | 0.940 | Near parity; individual processes are mixed |

Adding compact commit metadata and column event retention to this acknowledgement-heavy fixture produces mixed gains and regressions. It is not promoted as a default. Longer retained-event windows can benefit from a different storage choice; those are separate workloads. Shared-host variation is substantial, and these results do not establish universal latency or memory bounds.

[Exact plans, samples and conformance](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/reports/frontier-json-2026-10-13/current-kernels-339-341/README.md)

The newer package closure was measured again in processes 361–363. Ordinary replacement takes **2.585 µs versus Frontier 1.047 µs**, and prepared replacement **0.555 µs versus 0.575 µs**, using medians of process medians. Prepared Ink wins two processes and loses one. Against the previous Ink control ordinary calls improve 4–10%, while prepared calls regress 4–29%; the graph contains several independent changes, so these results are not attributed to the compact reader. Complete outcomes and exact snapshots pass. Unrelated compilation was active on the shared host.

[Newer graph and all process results](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/reports/frontier-json-2026-10-13/current-main-state-361-363/README.md)

## Fixed and adaptive execution

The complete-session adaptive comparisons include capture, queueing, recording and migrations. At 128 numeric rows, adaptive Ink loses to both scanning Frontier and an explicitly maintained Frontier sum in all six tested histories. Fixed cached Ink's read-only session takes 6.16 ms versus scanning Frontier's 12.48 ms; Frontier's maintained sum takes 2.98 ms. The efficient fixed representation matters as much as the controller.

A separate 4,096-row lifetime study measures 65,536 reads at 12.86 ms for fixed cached Ink, 279.19 ms for adaptive Ink and 356.44 ms for scanning Frontier. The adaptive controller eventually amortizes its cost here; shorter sessions and writes still lose. This is not evidence that adaptation is always beneficial or always harmful. These studies use supplied checked alternatives, not the best conceivable aggregate implementation.

[Matched complete-session controls](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/reports/adaptive-frontier-main-2026-10-14/README.md) · [Longer sessions and crossover evidence](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/reports/adaptive-frontier-2026-10-14/README.md)

## Optional JSON quotation reuse

The JSON boundary can explicitly reuse immutable quoted strings and their exact UTF-8 lengths. It retains grammar, Unicode, duplicate, member-order, source-resource and output-byte checks. Cache entry counts and estimated payload bytes are capped; no default enables the cache.

For 512-member Unicode/escape-heavy documents, three fresh processes measure about 25% less time for warm prepared rendering and 6–8% less for full text/edit/UTF-8 output. Independent 256-render sessions include cache creation, first fill, every compiled edit and full output consumption: all three take 21–24% less time than their paired uncached controls. Numeric and short-session results are mixed; cold renders are 38–40% slower on the Unicode fixture. Frontier still wins the complete text pipeline.

A separate forced-GC diagnostic measures about 106 KB retained per filled cache, with 1,024 entries and about 37 KB of estimated string payload. Clearing releases the observed retained allocation. This is a speed/memory tradeoff, not a heap reduction or peak-memory guarantee. The initial runtime prototype was later matched byte-for-byte by fresh compiler emission; all losing samples remain in the report.

[Cache contracts, source, lifecycle timings and memory diagnostic](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/reports/frontier-json-2026-10-13/json-quote-reuse-343-354/README.md)

[Captured-value APIs and trust scope](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/private-record-layouts.md#captured-private-value-boundaries) · [Bound benchmarks and corpus receipts](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/reports/frontier-json-2026-10-13/README.md#fused-external-capture-254259)

## Follow-up controls

Three processes now interleave previous and candidate state modules within each process. Prepared replacement takes 0.709 µs previous versus 0.695 µs candidate, while Frontier takes 0.436 µs. The candidate regresses in one process; ordinary replacement also shows no consistent gain. The reusable-cell/flat-event-buffer and direct table-call experiments were removed. These measurements support no new state-speed claim.

An ownership correction preserves same-sort aliases within one detached state reply, including recursive schema paths, while retaining separate memo keys for different erased source records. It shares no mutable containers with state or another invocation. The full JavaScript, JSON/maintained-state parity and cache/subscription checks pass.

A separate planning-engine study on an Apple M4 Pro retains selective database queries, search-local derived costs and lazy negative matching. Wide search falls from 15.212 s to 1.232 s over seven paired runs with identical output digests. Matching-heavy controls are essentially unchanged and one small broad-query control loses slightly. This measures planning overhead, not compiled application execution; its ratios should not be multiplied by JavaScript runtime gains.

[Rejected state experiments and ownership controls](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/reports/frontier-json-2026-10-13/README.md#state-controller-controls-260271) · [Planning engine protocol and tradeoffs](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/reports/pipeline-work-2026-10-14/README.md)

## Direct compiled JSON rendering

Generic typed reducers now let the JSON adapter render an opaque compiled handle
without rebuilding the logical tagged tree. Three fresh processes retain exact
outputs, source layouts, malformed-value checks and every timing lane. The table
shows medians of process medians, in microseconds:

| Fields | Prepared ordinary output | Prepared direct output | Ink direct text/edit/text | Frontier text/edit/text |
|---:|---:|---:|---:|---:|
| 4 | 6.050 | 2.859 | 13.269 | 0.839 |
| 64 | 34.533 | 19.058 | 70.361 | 4.241 |
| 512 | 220.497 | 122.717 | 451.177 | 99.612 |

At 512 fields, prepared rendering improves 1.58–1.80× within each process.
Medium and large complete pipelines improve in all three processes, but one
small-document run regresses. Input conversion and validation remain substantial
costs. Frontier uses native JSON on the shared finite-integer/Unicode domain;
Ink additionally preserves exact tokens/member order and enforces its source
resource bounds. These contracts differ, and the shared host had other builds
running. This is an opt-in API, with no universal default or all-metrics win.

The dictionary recipe's pinned database evaluation compiles all ten frozen
programs, discovers alternatives for six and selects alternatives for four. Its
coverage audit finds no unhandled entry roles. This establishes discovery and
admission scope; it does not prove that every optimisation is profitable.

[Rendering measurements and retained controls](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/reports/frontier-json-2026-10-13/typed-reduction.md) · [Frozen corpus and planning gates](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/reports/dictionary-layouts-published-2026-10-14/corpus/report.md)

## Measure your application

Start with the unchanged source and a baseline built by the same compiler. Keep development inputs separate from evaluation inputs. Check returned values, errors, events and snapshots before timing; consume the complete output during timing.

Include the phases your application pays for: compilation, startup, construction, calls, copying, transfers, migration, retained memory and teardown. Repeat in fresh processes and retain losing results. A faster warm query may not repay an index's setup and write costs, and a faster GPU kernel may lose once transfers are included.

[Benchmark inventory](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/BENCHMARKS.md) · [Current implementation status](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/STATUS.md)

## Checked wire readers and automatic boundary planning

The JavaScript ABI can validate and construct an opaque compiled value in one
traversal. The reader checks source frames, node/depth limits, scalar widths,
tags, Unicode, canonical numeric/ID/enum text and compact counts. Invalid reads
retain the generic validator's diagnostics. JSON number grammar and object-name
uniqueness remain separate checks.

Three fresh paired processes compare the same source and private layout:

| 512-field boundary | Previous decoder µs | Fused reader µs | Per-process result |
| --- | --- | --- | --- |
| Compact decode | 264.192 / 345.267 / 207.442 | 103.505 / 122.053 / 86.109 | 2.41–2.83× faster |
| Complete compact decode, edit and encode | 704.841 / 823.601 / 554.333 | 504.420 / 769.757 / 449.394 | 1.07–1.40× faster |

The 64-field complete compact pipeline regresses in every process by about
8–16%. Small inputs and portable decoding have mixed results. These measurements
therefore do not justify a global default or a Frontier win. Exact modules,
complete outputs, unchanged inputs and portable/compact bytes accompany the
reports. Cleanup archive work was paused; other shared-host work remained active.

The database now proposes reader choices per source function and format.
Automatic JavaScript calibration exercises trusted, portable and compact call
boundaries, measuring validation, execution, reply encoding and consumption of
every output byte. Source checking remains independent of the cost decision.

One automatic packet-copy compilation admitted four plans, generated 72 calls
and selected both readers under the paired uncertainty guard. Its estimated
candidate/baseline ratio was 0.881 with an upper bound of 0.930. Fresh proof replay
and 48 new encoded input checks passed. This single-process synthetic selection
result is not heldout performance evidence or a general usage forecast. Observed
profiles take precedence; missing comparable gains retains the baseline.

[Wire-reader measurements and losses](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/reports/frontier-json-2026-10-13/fused-wire-reader.md) · [Automatic selection, raw receipt and scope](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/reports/reader-planning-2026-10-14/REPORT.md)

## Compact reader specialization

The checked compact reader now tracks depth with a counter. Portable values keep their frame-end stack; compact values still check complete-buffer bounds, node/depth limits, canonical counts, tags, Unicode and full consumption. Invalid inputs replay the independent validator for established diagnostics.

Three paired fresh processes measure 11–14% less time for complete fused compact decoding and re-encoding of a 512-member document. This is an Ink-versus-Ink result, not a new Frontier ranking. The initial module used exact support substitution; fresh compiler emission later verified the identical ABI support, and its newer emitter passed full JavaScript tests and 422 additional malformed-input/resource/value checks. Complete modules differ because JavaScript main advanced independently.

[Exact reader cohorts and provenance](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/reports/frontier-json-2026-10-13/compact-reader-355-360/README.md)
