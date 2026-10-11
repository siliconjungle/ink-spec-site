## A small example

A table, a derived total and an atomic update:

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

`keep` defines a relationship: the total must agree with the table. `change` declares which state it can update and commits atomically.

Set two prices to 40 and 60: the total is 100. Change 40 to 45: the total is 105. An implementation could scan the table again or maintain the total with `100 - 40 + 45`. Ink can check that an alternative preserves the same behaviour, then compare its cost. A `keep` alone does not force a cache.

[Download this program](./prices.ink)

## Bring it into your app

Compile to a JavaScript module:

```sh
ink build prices.ink --target javascript -o prices.mjs
```

```js
import { createState } from './prices.mjs';

const prices = createState();
prices.invoke('set_price', [1n, 40n]);
prices.invoke('set_price', [2n, 60n]);
console.log(prices.invoke('total', []).result); // 100n

prices.invoke('set_price', [1n, 45n]);
console.log(prices.invoke('total', []).result); // 105n
```

Your app supplies inputs and reads results. Ink owns the typed state and the computation over it. Here, `u64` values cross the JavaScript boundary as BigInt.

## Split the work across targets

Ink can split a compiled pure pipeline across **JavaScript, WebAssembly and WebGPU**. Saved performance profiles guide which stages run where, using input size and accounting for startup, data transfers and repeated use. Consecutive GPU stages can keep their intermediate data on the device.

This works for eligible browser pipelines. Stateful changes stay on the host. [See how placement works](https://github.com/siliconjungle/ink-lang/blob/main/docs/adaptive-execution.md).

## Teach Ink a better way

Algorithms, storage layouts and transformation laws live in a separate knowledge database. Proposed optimisations carry proofs that Ink checks against the program. Measurements help choose among the valid alternatives.

That knowledge can remove intermediate collections, maintain derived results, introduce indexes or reuse unchanged immutable values. The compiler supplies the general execution machinery; the database supplies reusable ways to use it.

A new optimisation can improve existing code when it is rebuilt. The ambition is that a performance idea discovered in one program should help the next one.

## What runs today

Ink is a working prototype with typed tables, atomic changes, queries, generics and pure computation. It emits C, Rust, JavaScript and WebAssembly, with GPU execution for eligible work. Recent work includes indexed storage, grouped updates, maintained queries and shared immutable snapshots.

Coverage and performance depend on the program and target. The [reference](./reference.html), [implementation status](https://github.com/siliconjungle/ink-lang/blob/main/STATUS.md) and [benchmarks](https://github.com/siliconjungle/ink-lang/blob/main/BENCHMARKS.md) describe the supported cases and their costs.

[Get started](https://github.com/siliconjungle/ink-lang#get-started) · [Explore the code](https://github.com/siliconjungle/ink-lang) · [Design and ambitions](https://github.com/siliconjungle/ink-lang/blob/main/docs/vision.md)
