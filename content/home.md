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

## Code and queries, compiled together

A query can sit inside an ordinary function. Its result can feed more computation:

```ink
module queries;

fn selected(xs: List<u32>, minimum: u32) -> List<u32> {
    return list<u32>{
        from x in xs;
        where x >= minimum;
        select x * 3;
    };
}

fn total(xs: List<u32>, minimum: u32) -> u32 {
    return sum(selected(xs, minimum));
}
```

The wider ambition is to optimise that connected computation across application logic, queries, storage and execution targets. A plan could filter near storage, avoid intermediate collections, maintain a result as data changes, or keep a large parallel calculation on the GPU. The opportunity extends across the usual hand-off between fetching data and processing it.

Explicit learning can live in the same computation too: prepare a model, use
complete application context to evaluate an objective, and update designated
state with normal rollback and recovery. The CLI now includes prepared reverse
graphs and a 244-parameter ReGLU example; model training currently runs on CPU
hosts. [Learning through authored computation](./guide.html#prepare-a-model-and-learn-through-it).

The current CLI can also retain a structured `keep`: prepare a model architecture or
derived collection once, then reuse it while its checked inputs stay unchanged.
Training may continue to change the weights. This connects ordinary derived state
to prepared computation, with automatic invalidation and explicit recovery.
[Reuse and its costs](./guide.html#reuse-prepared-computation).
Prepared defaults can now seed mutable model state too. Stable construction is
reused while weights, optimizer moments and application controls continue to
change. This is another step toward compiling preparation, execution and learning
as one connected program; automatic graph specialization remains open.


Today, ordered list queries and eligible GPU execution work; external database pushdown, out-of-core query execution and an Ink-native storage engine remain future work. List queries preserve order and duplicates. A query alone does not guarantee a speedup.

[Try this query](./environment/?example=queries) · [How the pieces fit together](./guide.html#one-computation-across-the-stack) · [Query measurements](./performance.html#ordered-query-expressions)

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

Ink also targets native Rust and Rust/Wasm, with WebGPU for eligible pure computation. Use it for a focused piece of state or computation; keep the rest of your app where it is.

## Explore Ink

Ink is an open-source working prototype, not a production-ready promise. The language, compiler and knowledge library are evolving together.

[Try the editor](./environment/) · [Read the guide](./guide.html) · [Language reference](./reference.html) · [Performance results](./performance.html)


Prepared learning can also stay within that stack: ordinary source sessions queue
feedback, train a candidate while serving an accepted version, validate publication
and retain exact progress through durable recovery. Explicit build-stage training
packages the full learned application state for deployment, where learning can
continue. The current continuous service uses cooperative compiled JavaScript or
Wasm on CPU hosts. Explicit frozen builds can withdraw selected learning
capabilities while retaining normal application state. Automatic neural/arithmetic
specialization and parallel/device training remain work in progress.

Learning goals belong to the application author. Ink supplies mechanisms for
gradients, authored rewards, discrete choices and versioned feedback; the author
sets the objective, allowed changes, constraints and acceptance rules.
