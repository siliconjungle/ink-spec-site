## A small example

Store a price for each item and define a total:

```ink
module prices;

state Prices: Table<u64, u64> = Table.empty();

keep total_price: u64 = sum(Prices.values());

change set_price(item: u64, price: u64)
    -> Result<Unit, String> writes(Prices)
{
    if Prices.contains(item) {
        Prices.replace(item, price);
    } else {
        Prices.insert(item, price);
    }
    return Ok(());
}

query total() -> u64 reads(total_price) {
    return total_price;
}
```

`state` declares the table. `keep` defines a value derived from it. `change` updates the data, and `query` reads the total. Ink sees those relationships when it compiles the program.

## Optimisation knowledge lives outside the compiler.

Ink draws on a database of reusable algorithms, layouts and transformation laws. Each proposed transformation comes with evidence that the compiler checks before accepting it. Performance measurements help decide whether it is worth using.

That means a new optimisation can improve existing programs when they’re rebuilt. Application code stays the same, and the compiler doesn’t need a dedicated pass for every new idea.

## Try it.

Ink is a [working prototype](https://github.com/siliconjungle/ink-lang/blob/main/STATUS.md) with typed state, queries, atomic changes and pure computation. It targets native code, JavaScript and WebAssembly, with GPU support for eligible work.

Optimisation coverage is still growing. The documentation explains what works today, and the benchmarks show where it helps—and where it costs more.

[Get started](https://github.com/siliconjungle/ink-lang#get-started) · [Source code](https://github.com/siliconjungle/ink-lang) · [Benchmarks](https://github.com/siliconjungle/ink-lang/blob/main/BENCHMARKS.md)
