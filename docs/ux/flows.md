# UX Flows

## First sign-in

Visit the app, sign in with Google, bootstrap the role, create the SSR session cookie, then land on the dashboard with role-aware navigation.

States: auth loading, popup cancelled, network error, blocked browser settings, successful role-aware dashboard.

## Customer creates a product

Customer starts from the dashboard, enters product details, selects a published artist, crops cover art, uploads the image through a signed URL, submits metadata, and sees the product as pending review.

States: form validation, artist search loading/empty, image crop preview, upload progress, submission success, upload/API failure.

## Customer requests an artist

When the artist combobox has no matching published artist, the customer can request a new one. The request becomes `pending`; product creation remains blocked until an admin publishes the artist.

## Admin approves products

Admin opens the approval queue, reviews pending products, approves or rejects each row, and sees the row leave the pending list. Rejections may include a reason.

## Admin moderates artists

Admin opens the artist moderation view, reviews pending artist requests, approves or rejects them, and updates the roster used by the product form.

## Browse catalog

Customers see published products. Admins see all statuses and can filter by status.

## Locale switch

The topbar locale switcher changes visible copy between EN and NL and persists the preference.

## Theme switch

The theme control changes light/dark/system preference and persists the preference. New UI must be checked in both themes.
