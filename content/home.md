## A small example

Store prices. Define their total. Update the prices without letting the total drift out of sync.

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

`keep` describes a relationship that must stay true. `change` makes an atomic update. You write what the total means, without wiring up cache invalidation yourself.

[Run this example](./environment/?example=prices)

## Better implementations, same source

What if improving a program didn't always mean rewriting it?

Ink separates your program's meaning from its implementation. A growing knowledge library supplies algorithms, storage layouts and optimisation rules. The compiler checks the proofs behind a proposed transformation; measurements help choose between valid alternatives.

That makes optimisation reusable: a better implementation can become knowledge for the next program, not just a one-off hand-tuned rewrite. Your source keeps describing the problem.

## Bring it into your app

Compile Ink to a JavaScript module and call it from your application:

```js
import { createState } from './prices.mjs';

const prices = createState();
const setPrice = prices.bind('set_price');
const total = prices.bind('total', { resultOnly: true });

setPrice(1n, 40n);
setPrice(2n, 60n);
console.log(total()); // 100n
```

Ink also targets native C, Rust and WebAssembly, with WebGPU for eligible pure computation. Use it for a focused piece of state or computation; keep the rest of your app where it is.

## Explore Ink

Ink is an open-source working prototype, not a production-ready promise. The language, compiler and knowledge library are evolving together.

[Try the editor](./environment/) · [Read the guide](./guide.html) · [Language reference](./reference.html) · [Performance results](./performance.html)
