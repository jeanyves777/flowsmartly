# V5 sign-in and sign-up

Read of the legacy flow, then the standard the V5 screens are built to. Legacy
is `src/app/(auth)/*` in the root app — read for lessons, never imported.

---

## What the legacy flow gets wrong

### 1. Open redirect after authentication — security

`login/page.tsx:129` and `register/page.tsx:199`:

```ts
const redirectTo = searchParams.get("redirect");   // attacker-controlled
router.push(redirectTo || "/home");                // never validated
```

`/login?redirect=https://not-flowsmartly.example` signs the visitor in and then
sends them somewhere else, with the session already established and the
referrer showing the real site. It is the standard phishing shape, and nothing
on the server checks it either. `login/page.tsx:349` propagates the same
unvalidated value into the register link.

**V5:** a redirect is honoured only if it is same-origin and path-only — one
helper, applied everywhere a `?redirect=` is read, defaulting to the workspace.

### 2. Password rules are decoration

`register/page.tsx:134` builds `passwordChecks` for length, lower, upper and
number, renders them as ticks at lines 372-384, and never consults them.
`handleSubmit` validates one thing: that a country was picked. A one-character
password is submitted happily and the server is the only thing standing between
that and an account.

**V5:** the same rules gate the submit button, and the server stays the
authority — the client just stops wasting a round trip and tells the truth
about what is required.

### 3. Email verification is sent and then ignored

Register posts, a verification email goes out, and the code immediately does
`router.push(redirectTo || "/home")`. The account is fully usable without ever
opening the email, so the verification step is theatre.

**V5:** verification is either enforced before the workspace opens, or it is
not sent at all. A check nobody has to pass is worse than no check, because it
implies one exists.

### 4. Every error is a toast

Failures — wrong password, expired captcha, invalid 2FA — are announced with a
transient toast. It disappears, it is not tied to the field that is wrong, and
a screen-reader user gets a fly-past announcement rather than a labelled error
they can navigate back to.

**V5:** errors sit against their field, are wired with `aria-describedby` and
`aria-invalid`, and stay until the field changes. A toast is for something that
happened elsewhere, not for the form in front of you.

### 5. Sign-up asks for far too much

Name, email, **username**, password, **country**, and an optional referral code
— all before an account exists. Username and country are workspace settings, not
identity, and every extra required field is measured drop-off.

**V5:** email and password create the account. Everything else is asked once
there is a workspace to attach it to, where it can be skipped.

### Also noted

- The 2FA field only appears after a failed sign-in, so anyone with 2FA on
  fails their first attempt by design. In V5 the code step is its own screen,
  reached when the server says the account has 2FA.
- `isAgentFlow` is inferred by string-matching the redirect
  (`redirectTo === "/agent/apply"`), which couples a visual variant to a URL
  literal in two files.

---

## The V5 standard these are built to

Same rules as the rest of `apps/v5` — they are not relaxed because it is a form.

- **Tokens only.** No colour literal; three themes are all shipping states.
- **One breakpoint scheme**, `useLayout()`. The card is one column throughout;
  the split only decides whether the brand panel beside it is drawn.
- **44px minimum touch target, 11px minimum text**, including the show/hide
  password control and the "resend code" link.
- **The form works with JavaScript off** as far as a static export can take it:
  a real `<form>`, real labels, real `autocomplete` (`email`,
  `current-password`, `new-password`, `one-time-code`), so password managers
  and autofill behave.
- **Reduced motion** removes the reveal, never the content.
- **Errors are text, not colour.** Red alone fails anyone who cannot see red.
- **Nothing invented about the backend.** V5's API is a separate greenfield
  repo; these screens name the fields they need and the states they can be in,
  and the contract is agreed rather than assumed.

## Screens

| Screen | Purpose |
| --- | --- |
| Sign in | email + password, link to reset, social if enabled |
| Two-factor | its own step, reached only when the server asks for it |
| Create account | email + password only, with the rules shown and enforced |
| Check your email | the state after signing up or asking for a reset |
| Reset password | new password, same rules, from an emailed token |
