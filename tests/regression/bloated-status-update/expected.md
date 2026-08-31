Target shape, not a string to diff against:

> I found the staging latency regression: the incremental reindex path was
> the cause, fixed in #813. there might be more edge cases since I only
> validated the read path. search now reindexes without the staging slowdown,
> and bad documents land in a dead-letter queue instead of stalling the
> consumer. we can see reindex failures in metrics now too. still more to do
> on the remaining items.

Roughly 65 words against the original's 200, with every fact intact.

On the metrics clause: the input lists four things built, and metrics is one
of them, so it cannot be dropped (never invent facts: `rules/hard.md`, rule 3). It survives as what the
metrics let a reader do, not as "wired up metrics collection," because a
component inventory is exactly what group Z removes. An earlier version of
this target dropped the fact while claiming every fact was intact; that was a
gap in the target, not a shorter correct answer.
