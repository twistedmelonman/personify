```python
def refresh_session(session_id: str) -> Session | None:
    # First, we look up the session in the cache. This is important because
    # going to the network on every refresh would be slow, and we want to
    # avoid that if at all possible.
    cached = CACHE.get(user_id_for(session_id))

    # If we found something in the cache, we can return it directly.
    if cached is not None:
        # Return the cached session.
        return cached

    # Otherwise, we need to fetch it from the auth service. See
    # https://internal.example.com/wiki/AuthService for more details about
    # how the auth service works and why it is designed this way.
    fetched = AUTH.fetch(session_id)

    # Now we store the result in the cache so that subsequent calls will be
    # faster. Note that we use a 55 second TTL here.
    CACHE.set(user_id_for(session_id), fetched, ttl=55)

    # Finally, return the session we fetched.
    return fetched
```

The 55 second TTL is deliberate: the auth service rotates its signing keys on a
60 second cycle, so a longer TTL can serve a session signed by a retired key.
