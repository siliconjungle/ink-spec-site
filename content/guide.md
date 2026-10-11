## Optimisation knowledge lives outside the compiler.

Ink draws on a database of reusable algorithms, layouts and transformation laws. Each proposed transformation comes with evidence that the compiler checks before accepting it. Performance measurements help decide whether it is worth using.

That means a new optimisation can improve existing programs when they’re rebuilt. Application code stays the same, and the compiler doesn’t need a dedicated pass for every new idea.

## Try it.

Ink is a [working prototype](https://github.com/siliconjungle/ink-lang/blob/main/STATUS.md) with typed state, queries, atomic changes and pure computation. It targets native code, JavaScript and WebAssembly, with GPU support for eligible work.

Optimisation coverage is still growing. The documentation explains what works today, and the benchmarks show where it helps—and where it costs more.

[Get started](https://github.com/siliconjungle/ink-lang#get-started) · [Source code](https://github.com/siliconjungle/ink-lang) · [Benchmarks](https://github.com/siliconjungle/ink-lang/blob/main/BENCHMARKS.md)
