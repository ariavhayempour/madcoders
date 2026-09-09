# 0009 — Contact form (inquiry / join / digest)

Three placements — `/contact` (inquiry), `/team` (join), and `/create-next-digest` (digest) —
render a name + email + message form that POSTs to one SSR route for abuse and validation
checks, then delivers the message by email through Web3Forms. Pure Astro + one scoped
`<script>` — no React, no new dependency.

Submissions are **not stored**. The database write and the admin inbox were removed; email is
the only delivery path, so a failed send is surfaced to the user rather than swallowed.

## Data flow

```
InquiryForm.astro (scoped <script>, type prop)
  → validateSubmission()            (client-side pre-submit feedback)
  → fetch POST /api/inquiry         { name, email, type, message, company }
      → checkAbuse()                (honeypot + rolling-gap rate limit)
      → validateSubmission()        (server is the authority — re-runs the same rules)
  ← 201 ok | 400 errors | 429 rate_limited
  → on 201: browser POSTs to api.web3forms.com/submit, checks `success`
  → success → confirmation | failure → error, form values kept
```

## Why the browser sends the email

Web3Forms rejects server-to-server calls on the free plan — a server-side POST returns
`403 "This method is not allowed. Use our API in client side..."` regardless of key validity,
and a browser-shaped request from a server IP hits a Cloudflare challenge instead. The send
therefore happens in the client script, matching Web3Forms' documented usage.

The access key is exposed in the page as `PUBLIC_WEB3FORMS_ACCESS_KEY`. That is inherent to
client-side submission and is the tradeoff Web3Forms expects; the key only permits sending to
the form owner's configured address.

Because `/contact` is prerendered, the key is inlined at **build time** — changing it requires a
rebuild, not just an env update.

## Submission type

`src/lib/submission-validation.ts` exports `SUBMISSION_TYPES = ['inquiry', 'join', 'digest']`
and the `SubmissionType` union. It lives beside the validation rules rather than in `db/schema.ts`
because it no longer describes a database column. `InquiryForm.astro` takes a `type` prop carried
in a hidden field; the route coerces an absent `type` to `''` so an unknown value fails validation.

## Email rule

Any well-formed address is accepted. The earlier `@wisc.edu` restriction was removed so
non-student collaborators, alumni, and outside orgs can reach the club.

## Abuse protection

Unchanged from 0010: honeypot field, plus a three-minute rolling gap keyed on both IP and a
hashed email bucket. The guard runs before validation so bot noise never reaches it.
