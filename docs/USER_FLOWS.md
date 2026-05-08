# User Flows

These are the main user journeys in the app. A shorter overview also lives at [`./ux/flows.md`](./ux/flows.md).

## First sign-in

```
Visit the app
  → unauthenticated route guard sends the user to login
  → user chooses Google sign-in
  → Firebase Auth completes popup flow
  → backend bootstrap assigns customer or admin role
  → frontend creates the SSR session cookie
  → dashboard opens with role-aware navigation
```

Expected states:

- Loading while Firebase initializes.
- Recoverable error if popup is blocked or closed.
- Blocked state if the browser cannot complete the sign-in flow.
- Role-aware success state after bootstrap.

## Customer creates a product

```
Dashboard / Products
  → Create product
  → enter product details
  → select a published artist
  → choose and crop cover art
  → review
  → request signed upload URL
  → upload image directly to Storage
  → create product metadata through API
  → product appears as Pending review
```

Important behaviours:

- Product submission is blocked until a valid artist and cover art are present.
- Customers can only attach products to published artists.
- The final product is not public until an admin approves it.
- Upload failures should not create product metadata.

## Customer requests a missing artist

```
Product create form
  → search artist combobox
  → no matching published artist
  → choose Add new artist
  → submit artist request
  → artist is created as pending
  → product submission waits until the artist is approved
```

The artist request can succeed even though product creation remains blocked. This is intentional: the customer should not need to retype the artist later, and the admin queue has a record to moderate.

## Admin approves a product

```
Admin navigation
  → Approval queue
  → view pending products
  → approve or reject
  → API records the status change
  → row leaves the pending queue
```

Admin actions emit structured operational logs. The queue should handle loading, empty, success, error, and forbidden states.

## Admin moderates artists

```
Admin navigation
  → Artists
  → Pending tab
  → approve or reject requested artist
  → artist moves to Published or Rejected
```

When an artist is approved, customers can select it for product creation.

## Browse catalog

```
/products
  → customer sees published products
  → admin sees all products and can filter by status
```

The list view should show thumbnail, product name, artist, and status where the role needs it.

## Locale switch

```
Topbar locale switcher
  → choose EN or NL
  → visible strings update
  → preference persists
```

Every user-facing string added to a flow needs EN and NL entries.

## Theme switch

```
Topbar theme control
  → choose light, dark, or system behaviour
  → Tailwind dark class/token state updates
  → preference persists
```

New surfaces should be checked in both light and dark modes. Motion should respect reduced-motion preferences.

## Related tests

The E2E coverage for these journeys is tracked in [`TEST_SCENARIOS.md`](./TEST_SCENARIOS.md) and [`./qa/coverage-matrix.md`](./qa/coverage-matrix.md).
