# Manual Athena export contracts

Phase 1 uses manual, de-identified data extracts only.

## Recommended CSV contracts

### schedule_utilization.csv
- provider_id
- provider_role
- service_line
- week_start
- available_slots
- booked_slots
- completed_visits
- no_shows
- same_day_add_ons

### operational_metrics.csv
- employee_id
- employee_role
- period_start
- period_end
- task_completion_rate
- training_completion_rate
- audit_pass_rate
- issue_close_rate
- complaint_count
- note_lag_days
- refill_turnaround_hours
- schedule_fill_rate

### prescribing_exceptions.csv
- provider_id
- period_start
- period_end
- stimulant_exceptions
- benzo_exceptions
- opioid_exceptions
- testosterone_exceptions
- telehealth_exceptions
