export {
  build_checklist_items,
  build_driver_progress_state,
  can_driver_operate,
  can_show_driver_onboarding,
  can_update_driver_progress,
  count_completed_items,
  DRIVER_PROGRESS_KEYS,
  DRIVER_PROGRESS_LABELS,
  empty_driver_progress,
  normalize_driver_progress,
  normalize_driver_progress_value,
  normalize_driver_status,
  is_all_progress_complete,
  is_driver_provisional,
  seed_driver_progress_from_entry,
  validate_license_upload,
  validate_progress_append,
} from "@/core/driver/progress/rules"

export type {
  DriverChecklistItem,
  DriverProgress,
  DriverProgressEntry,
  DriverProgressKey,
  DriverProgressRow,
  DriverProgressState,
  DriverProgressValidationResult,
} from "@/core/driver/progress/rules"
