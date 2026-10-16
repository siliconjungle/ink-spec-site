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

## Software that learns and adapts

Mark the parts of your program that may learn, define an objective over its
computation and context, and set the constraints each update must respect.
Your code decides what can change and what counts as better.

Train before deployment, adapt to runtime feedback, or keep learning while the
software runs. Save, resume and ship the learned state with your application.
The goal can concern behaviour, decisions or performance—whatever you author.

```ink-cli
trainable state Gain: f32 = 1.0;

adaptive query predict(x: f32) -> f32 reads(Gain) {
    return Gain * x;
}

learn change feedback(x: f32, target: f32) -> Result<Unit, String>
    reads(Gain) writes(Gain) {
    let error = Gain * x - target;
    Gain = Gain - 0.01 * error * x;
    return Ok(());
}
```

Here, feedback adjusts the prediction toward the supplied target. Your application
defines the learning rule and when it runs. [Complete example for the current Ink CLI](./adaptive-gain.ink).

[Explore adaptive Ink](./guide.html#authored-code-with-explicit-learning) ·
[Training through application logic](./guide.html#train-through-authored-computation)

A learned choice can also select program structure. Explicitly freeze a choice,
then use checked specialization to remove its unused serving branches. Objectives
can be authored and reconfigured too, with explicit rules for old feedback.
[Learn a program structure](./guide.html#learn-a-program-structure).

Ink also has an example that learns a 32-operation instruction sequence from
whole-computation output targets, then compiles the frozen sequence with checked
proofs. Weights, goals and live inputs can still change. The instruction grammar
and objective belong to the application.
[Learn instruction sequences](./guide.html#learn-instruction-sequences).

The planner's goal can be authored code too. A learner can change how already
checked variants are ranked—for latency, memory or application-defined utility—
within the program's permitted choices and constraints.
[Give the planner a goal](./guide.html#give-the-planner-an-authored-goal).

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
