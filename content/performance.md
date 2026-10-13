## Read the comparisons

Every result needs a baseline. Adding knowledge to a fixed compiler, improving the compiler itself and comparing with another library answer different questions. Their speedup factors should not be multiplied together.

The results below are published experiments from 13 October 2026. Each report retains its acquired source revisions, inputs and controls. Updating the documentation or planner does not rerun those experiments.

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

The latest published compact-construction release compares separate boundaries against Frontier. Results are medians of three fresh-process medians on a shared Node 26.1 / Apple M2 host, with complete-output preflight and rotated timing rounds. Time is in microseconds per call; lower is better.

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

Proof admission, target eligibility and profitability are separate gates. An implementation must preserve the required meaning and be executable on the target before cost evidence can select it. Missing comparable lifecycle evidence keeps ordinary selection on the baseline.

The work-model path is an explicit experimental option in the Python compiled planner. Supply both `--work-model` and `--work-workload` to enable it. It can predict gains when ordinary selection lacks comparable evidence; it does not override a timing-based decision. Its current held-out study selected one of ten programs, with a 1.53× gain for that program. The reference-fuel model was rejected. This is narrow evidence, not established general prediction.

Current planner safeguards include:

- Average work per phase before applying lifecycle frequencies, so extra sample inputs do not silently alter the workload mix.
- Bind both model and workload contents into the compiled-plan cache key; replay the selected proof chain on a cache hit.
- Retain the baseline when a memory limit or nonzero migration count needs evidence the work model does not provide.
- Keep model selection opt-in and report the decision separately from measured speedups.

[Work-model protocol and held-out results](https://github.com/siliconjungle/ink-planner/blob/5dd9523c5f5b97df517c12b610d5ba126dc785cf/docs/work-model.md) · [Selection reference](./reference.html#chapter-13)

## Research under evaluation

A checked physical plan can now remove single-field record wrappers in compiled JavaScript. In three fresh-process cohorts, the selected 4,096-row state retains 2.33 MB versus ordinary Ink’s 3.24 MB: 28.3% less heap. Replacement takes 2.32 µs versus 2.85 µs, an 18.4% reduction. Frontier still wins at approximately 0.7 µs and 0.84 MB. Public JSON trees keep their logical format and do not gain this memory reduction.

Selecting the layout across the whole module makes logical JSON calls slower because they convert inputs and reconstruct outputs. Detached edits take 328 µs with elision versus 37 µs with ordinary Ink and 101 µs with Frontier. The previous Ink release rerun also takes about 36 µs, so the older 53-to-37 µs comparison does not establish a new compiler speedup. These are explicit alternatives, not an unconditional default. Private captured-value and wire boundaries remain integration work.

Earlier flattened-sum, tagged-word and dictionary probes remain isolated carrier experiments. They do not establish compiled action or transaction performance. The measured modules precede the concurrent JavaScript object-adapter addition; reports retain their exact bytes and scope.

The native proof-authoring path now offers an explicit `shared-v2` Boolean circuit encoding alongside the unchanged default `literal-v1`. A representative obligation shrinks from 78,828 clauses to 1,763. This reduces proof construction costs; it does not establish a compiled-program speedup or authorise a new datatype layout. The report also records two baseline hardening-test failures that remain open.

[Compiled layouts, experiments and limits](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/reports/frontier-json-2026-10-13/README.md#compiled-record-elision-217237) · [Shared circuits, trust scope and open tests](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/shared-bit-circuits.md)

## Captured private values

The compiled JavaScript module now offers typed opaque handles through `compiledValues` and `callCompiled`. Capture validates and owns the input once; subsequent calls retain the private representation. Materialize an owned public value only when needed, or encode the handle directly for transport. Binary calls also use literal private readers and writers. These boundaries apply to general first-order Ink values.

In three fresh-process cohorts, a captured 512-field document edit with a complete detached output takes **36.536 µs** versus **104.964 µs** for the paired Frontier lane: **2.87× faster**. Initial capture is excluded from those hot calls and reported separately: approximately **2.8 ms** for Ink’s validation/capture/conversion versus **45 µs** for Frontier’s clone. Retaining a private output takes 3.283 µs, but that is a different output contract and has no matched Frontier win claim.

The selected layout’s full binary text pipeline remains 797.950 µs, and its logical text pipeline 830.311 µs. The end-to-end Frontier goal remains open. Workload profiles must account for setup, reuse, retained memory and the chosen output boundary.

The frozen ten-program quick corpus compiles all programs and admits alternatives for seven, but selects none at the default evidence gates. Quick budgets defer the new layout family. Interleaving recipe stages and allowing the balanced budget discovers two record-layout proposals and admits them on the unchanged `compact-set` program; this proves discovery and admission, not profitability.

[Captured-value APIs and trust scope](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/docs/private-record-layouts.md#captured-private-value-boundaries) · [Bound benchmarks and corpus receipts](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/reports/frontier-json-2026-10-13/README.md#captured-private-values-and-literal-binary-calls-242247)

## Measure your application

Start with the unchanged source and a baseline built by the same compiler. Keep development inputs separate from evaluation inputs. Check returned values, errors, events and snapshots before timing; consume the complete output during timing.

Include the phases your application pays for: compilation, startup, construction, calls, copying, transfers, migration, retained memory and teardown. Repeat in fresh processes and retain losing results. A faster warm query may not repay an index's setup and write costs, and a faster GPU kernel may lose once transfers are included.

[Benchmark inventory](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/BENCHMARKS.md) · [Current implementation status](https://github.com/siliconjungle/ink-lang/blob/{{ink_revision}}/STATUS.md)
