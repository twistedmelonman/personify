Target shape, not a string to diff against:

```python
def refresh_session(session_id: str) -> Session | None:
    cached = CACHE.get(user_id_for(session_id))
    if cached is not None:
        return cached

    fetched = AUTH.fetch(session_id)
    # 55s, not 60: the auth service rotates signing keys every 60s.
    CACHE.set(user_id_for(session_id), fetched, ttl=55)
    return fetched
```

One comment against seven lines of code, down from eleven comment lines. Every
other comment went because an informed reading of the code already says it: the
cache lookup, the early return, the fetch, the store, the return.

The surviving comment is the one fact no reading of the code recovers. The
number 55 is unexplained in the code and looks like a typo for 60, which is
exactly the case for a comment. It fits on one line and does not narrate the
call under it.

The wiki link is gone. Links in comments rot, and this one explained the auth
service in general rather than this call in particular.

The TTL rationale arrived as prose outside the code block, and it belongs in the
comment. Moving it in is not inventing a fact: it was in the input. A run that
drops it entirely has lost a fact and fails, per `rules/hard.md` rule 5.
