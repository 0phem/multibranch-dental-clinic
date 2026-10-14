# Design references for the patient portal

- `docs/design-references/` did not exist / was empty when the portal was rebuilt (checked 2026-10-14), so the portal follows
  **design A** (the visual language already used by the emails, PDFs, sign-in and dashboards: mint and light-blue tints,
  rounded cards, confident numbers, the brand accent bar).
- The booking calendar and time selection follow the **passport-appointment pattern** as inspiration only (a month grid with
  closed and fully booked days disabled, available days highlighted, today marked, month navigation limited to the booking
  window, and time chips grouped Morning and Afternoon). No artwork, layout or code was copied from any appointment site.
  The component is `src/patient/BookingCalendar.jsx` and is reused for rescheduling.
- Asset sources and licences: `docs/CREDITS.md`.
