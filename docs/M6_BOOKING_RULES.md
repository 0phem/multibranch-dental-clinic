# M6 Appointment Booking & Smart Scheduling: Patient booking rules

Current rules for online booking by a Patient (patient portal, `src/patient/pages/Book.jsx`). The server enforces every rule
(`SchedulingService::evaluate`); the portal only shows what the server allows.

## Choosing a Dentist (approved 2026-10-14)

- A Patient **may optionally pick a Dentist** when booking, or choose **"Any available"** (the default). With "Any
  available", the server assigns an eligible Dentist automatically, as before.
- A chosen Dentist must exist, work at the chosen branch, do the chosen service and be free at that time. An **unknown
  Dentist** is refused (422, `dentist_ref`), and a Dentist **not working at that branch** is refused by the scheduling checks
  (and gets no open times).
- Before this change, `dentist_ref` was prohibited for Patients. Requests: `AvailabilityRequest`, `StoreAppointmentRequest`.
  Rescheduling by a Patient still keeps the server's assignment (`RescheduleAppointmentRequest` still prohibits `dentist_ref`).
- Tests: `AppointmentBookingTest::test_client_cannot_choose_status_source_or_patient_fields_or_an_unknown_or_ineligible_dentist`,
  `AppointmentCutoverSupportTest::test_availability_can_be_limited_to_one_dentist_for_staff_and_patients`.

## Opening days

- `branches.operating_days` lists the ISO weekdays a branch takes appointments (1 = Monday … 7 = Sunday). Empty means every
  day. The Owner sets it per branch. A day not listed is refused (`branch-day` check), and the calendar shows it as closed.
- Demo default (approved 2026-10-14): Sunday closed, Monday to Saturday open, for every demo branch
  (`DemoClinicSeeder::demoOpeningDays`, only where a branch has no closed days yet). The clinic's real days are an open item.

## Booking window, calendar and branch suggestions

- Online booking runs from tomorrow to one month ahead (`SchedulingService::patientWindow`).
- `GET /api/appointments/calendar` returns each day of a month as available, full, closed, past or outside. The search stops at
  the first open time of a day.
- `GET /api/appointments/branch-options` ranks branches by distance (only when the browser sends a location; never stored) and
  then by the earliest open time. Without a location, or for a branch without coordinates, it ranks by the earliest open time.
- Nothing is paid at booking (decision 4): the invoice comes after the visit.
