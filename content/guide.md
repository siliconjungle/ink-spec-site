## Philosophy

Keep the contract clear. Make better implementations reusable. A better algorithm, a smarter layout, a way to avoid unnecessary work: each discovery should become knowledge that other programs can use.

Ink’s optimisation knowledge evolves independently of its compiler. New proved transformations can improve existing programs when rebuilt, without changing their source or adding dedicated compiler passes.

## Same meaning. Less work.

A collection fusion law can combine two maps into one:

```ink
xs.map(f).map(g)

// A proved alternative for pure, total mappings:
xs.map(fn(x) => g(f(x)))
```

The proof establishes the same result. Measurements guide whether the alternative is worth choosing. One law can serve many programs.

## Room for better implementations

The ambition reaches beyond expressions: algorithms, indexes, cached results, storage layouts and execution targets.

Your program defines the contract. A planner proposes alternatives. The core checks the evidence. Implementation knowledge keeps growing.

Ink is a working prototype. Checked optimisation works in supported domains; broader coverage and consistently faster execution remain active work. [Current state](https://github.com/siliconjungle/ink-lang/blob/main/STATUS.md) · [Evidence](https://github.com/siliconjungle/ink-lang/blob/main/BENCHMARKS.md)
