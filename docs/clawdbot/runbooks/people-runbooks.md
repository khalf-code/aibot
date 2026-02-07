# People (HR) Runbooks — Business Skill Packs

Runbooks for all People workflows in the Clawdbot Business Skill Packs.

Covers:

- BIZ-087 (#179) Interview scheduling assistant docs + runbook
- BIZ-090 (#182) New hire paperwork checklist docs + runbook

---

## Interview Scheduling Assistant

**Workflow ID:** `people-interview-scheduling`
**Trigger:** Manual (initiated by recruiter) or webhook from ATS
**Approval gate:** Recruiter

### Overview

Analyses interviewer availability, candidate preferences, and room/resource availability to propose an optimal interview schedule. Pauses for recruiter approval before sending calendar invites to interviewers and the candidate.

### Prerequisites

- Applicant Tracking System (ATS) integration configured
- Calendar integration for interviewer availability (Google Calendar, Outlook, etc.)
- Room/resource booking system access (if scheduling in-person interviews)
- Candidate communication channel configured (email)
- Interviewer pool defined per role/team

### Steps

1. **Receive scheduling request** -- Accept the scheduling request with candidate details, required stages, and preferred formats.
2. **Fetch interviewer availability** -- Query calendar systems for each interviewer's free/busy status within the scheduling window.
3. **Fetch candidate preferences** -- Retrieve the candidate's timezone and availability preferences from the ATS or direct input.
4. **Check room availability** -- For in-person interviews, query the room booking system for available meeting rooms.
5. **Generate schedule** -- Compute an optimal schedule that minimises gaps, respects timezone constraints, and matches format preferences.
6. **Detect conflicts** -- Identify any remaining scheduling conflicts (double-bookings, timezone mismatches, room shortages).
7. **Approval gate** -- Pause for recruiter review. The recruiter sees the proposed schedule, any conflicts, and interviewer confirmation status.
8. **Send calendar invites** -- Create and send calendar invitations to all interviewers and the candidate.
9. **Notify recruiter** -- Confirm all invites were sent and flag any that bounced.
10. **Notify candidate** -- Send the candidate a confirmation email with schedule details, preparation tips, and contact information.

### Failure handling

- Calendar API failures are retried 3 times. If the calendar remains unreachable, the interviewer is marked as "availability unknown" and the recruiter is alerted.
- Room booking failures fall back to video call format with a note for the recruiter.
- Calendar invite send failures are retried once; failures are logged and the recruiter is asked to send manually.

### Rollback

- If the schedule needs to change after invites are sent, the recruiter can re-trigger the workflow with updated parameters. Previous invites should be manually cancelled or the workflow can send cancellation notices (future enhancement).

---

## New Hire Paperwork Checklist

**Workflow ID:** `people-new-hire-paperwork`
**Trigger:** Manual (initiated by HR) or webhook from HRIS
**Approval gate:** HR administrator

### Overview

Generates a personalised paperwork checklist for a new hire based on their role, work location (for jurisdiction-specific requirements), and employment type. Pauses for HR approval before sending the checklist to the new hire. Tracks completion and sends reminders for outstanding items.

### Prerequisites

- HRIS integration or manual input for new hire details
- Document template library with jurisdiction-specific forms
- Digital signature platform integration (e.g. DocuSign, HelloSign) if applicable
- Employee self-service portal for checklist tracking
- Reminder notification channel configured (email)

### Steps

1. **Receive new hire info** -- Collect employee details (name, email, job title, employment type, work location, start date).
2. **Determine jurisdiction** -- Map the work location to the appropriate legal jurisdiction for tax forms, employment agreements, and regulatory requirements.
3. **Generate checklist** -- Build a personalised list of required paperwork items based on jurisdiction, employment type, and role.
4. **Attach document links** -- Associate each checklist item with the correct form template or document URL.
5. **Approval gate** -- Pause for HR administrator review. The reviewer can add, remove, or modify checklist items and verify jurisdiction-specific requirements.
6. **Send checklist to hire** -- Email the new hire their personalised checklist with links to complete each item.
7. **Track completion** -- Monitor the self-service portal for completed items. Update the checklist status as items are submitted.
8. **Send reminders** -- For items still pending as the start date approaches, send reminder emails at the configured frequency.
9. **Notify HR on completion** -- When all items are complete (or the start date arrives), notify the HR team with a completion summary.

### Failure handling

- Document link generation failures flag the item as "manual" and notify HR to provide the link directly.
- Email delivery failures are retried once; persistent failures are logged for manual follow-up.
- Reminder scheduling uses the notification retry policy (1 retry).

### Rollback

- The checklist can be regenerated by re-triggering the workflow. Previously completed items are preserved if the same employee record is used.
- If the new hire's start is cancelled, HR can manually mark the workflow as cancelled, which stops further reminders.
