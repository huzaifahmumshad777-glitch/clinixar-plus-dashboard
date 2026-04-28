# Security Specification for Clinic Dashboard

## Data Invariants
- A patient record must have an `ownerId` matching the authenticated user's UID.
- `consultation_fee` must be a non-negative number.
- `status` must be one of 'Pending', 'Completed', 'Cancelled'.
- `appointment_date` must be a valid date string.

## The Dirty Dozen Payloads (Target: /patients/{id})

1. **Identity Spoofing**: Create record with someone else's `ownerId`.
2. **Identity Spoofing (Update)**: Change `ownerId` of an existing record.
3. **Privilege Escalation**: Try to read another user's patient list.
4. **Invalid Type (Fee)**: Set `consultation_fee` to "1000" (string) or -50.
5. **Shadow Field**: Add `is_admin: true` to the patient document.
6. **State Shortcutting**: Directly set status to 'Completed' without all required fields.
7. **Malformed ID**: Try to write to `/patients/JUNK_CHARACTERS_123!@#$`.
8. **Resource Exhaustion**: Send a `notes` string that is 1MB in size.
9. **Zero-Day Delete**: Try to delete a record belonging to another user.
10. **Timestamp Fraud**: Provide a fake `created_at` from 1990.
11. **Enum Bypass**: Set `status` to 'In-Progress'.
12. **Search Scraping**: Try to list all patients without filtering by `ownerId`.

## Test Plan
All above payloads should return `PERMISSION_DENIED`.
