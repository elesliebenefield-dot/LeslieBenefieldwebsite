import type { StarterTaskDef } from './closingTypes'

// ── Starter task library ───────────────────────────────────────────────────────
// Organized by track. Every task is optional — none implies a contractual obligation.

export const STARTER_TASKS: StarterTaskDef[] = [

  // ── Closing coordination ────────────────────────────────────────────────────
  { key: 'cc_confirm_appt',      label: 'Confirm appointment logistics with the appropriate professional',                         track: 'closing_coordination', defaultPeriod: 'before_closing' },
  { key: 'cc_gather_id',         label: 'Gather identification or other items requested for the appointment',                      track: 'closing_coordination', defaultPeriod: 'before_closing' },
  { key: 'cc_record_questions',  label: 'Record questions for the agent, lender, attorney, title, or escrow professional',         track: 'closing_coordination', defaultPeriod: 'before_closing' },
  { key: 'cc_confirm_possession',label: 'Confirm user-entered possession or key-handoff timing',                                   track: 'closing_coordination', defaultPeriod: 'before_closing' },
  { key: 'cc_confirm_docs',      label: 'Confirm how documents will be delivered or signed',                                       track: 'closing_coordination', defaultPeriod: 'before_closing' },
  { key: 'cc_unresolved',        label: 'Record unresolved transaction questions for the appropriate professional',                track: 'closing_coordination', defaultPeriod: 'before_closing' },
  { key: 'cc_walkthrough',       label: 'Confirm final walkthrough details with your agent or professional contact',               track: 'closing_coordination', defaultPeriod: 'before_closing' },
  { key: 'cc_keys_plan',         label: 'Plan for key or access-device pickup or handoff after signing',                          track: 'closing_coordination', defaultPeriod: 'closing_day' },

  // ── Leaving property ────────────────────────────────────────────────────────
  { key: 'lv_final_cleanout',    label: 'Plan and complete the final cleanout',                                                    track: 'leaving', defaultPeriod: 'before_move_out' },
  { key: 'lv_keys_remotes',      label: 'Account for all keys, remotes, access devices, and manuals',                             track: 'leaving', defaultPeriod: 'before_move_out' },
  { key: 'lv_utilities',         label: 'Arrange final utility termination or transfer timing',                                    track: 'leaving', defaultPeriod: 'before_move_out' },
  { key: 'lv_moving_access',     label: 'Confirm moving-day access, parking, and any building or HOA requirements',               track: 'leaving', defaultPeriod: 'before_move_out' },
  { key: 'lv_handoff',           label: 'Plan the property handoff and confirm what items are included',                          track: 'leaving', defaultPeriod: 'before_move_out' },
  { key: 'lv_items_to_confirm',  label: 'Record items that need professional confirmation before the handoff',                    track: 'leaving', defaultPeriod: 'before_move_out' },
  { key: 'lv_repair_items',      label: 'Note any agreed-upon or pending repair items',                                           track: 'leaving', defaultPeriod: 'before_move_out' },
  { key: 'lv_personal_property', label: 'Confirm removal of all personal property not included in the sale',                      track: 'leaving', defaultPeriod: 'before_move_out' },

  // ── Arriving property ───────────────────────────────────────────────────────
  { key: 'ar_utilities',         label: 'Plan utility start dates for the new property',                                          track: 'arriving', defaultPeriod: 'before_closing' },
  { key: 'ar_key_pickup',        label: 'Confirm how and when keys or access devices will be received',                           track: 'arriving', defaultPeriod: 'closing_day' },
  { key: 'ar_moving_access',     label: 'Plan moving-day access, elevator booking, or parking arrangements',                     track: 'arriving', defaultPeriod: 'before_closing' },
  { key: 'ar_essentials_area',   label: 'Prepare a labeled essentials-first area for moving day',                                 track: 'arriving', defaultPeriod: 'moving_day' },
  { key: 'ar_walkthrough_qs',    label: 'Record questions for the final walkthrough or appropriate professional',                 track: 'arriving', defaultPeriod: 'before_closing' },
  { key: 'ar_service_access',    label: 'Schedule optional service-provider visits or access after move-in',                     track: 'arriving', defaultPeriod: 'first_week' },
  { key: 'ar_hoa_mgmt',          label: 'Confirm HOA or building management contact and requirements',                            track: 'arriving', defaultPeriod: 'before_closing' },

  // ── Packing and moving day ──────────────────────────────────────────────────
  { key: 'mv_choose_movers',     label: 'Choose movers, a vehicle, or moving help',                                               track: 'moving_day', defaultPeriod: 'before_move_out' },
  { key: 'mv_packing_zones',     label: 'Create packing zones and a room-by-room plan',                                           track: 'moving_day', defaultPeriod: 'before_move_out' },
  { key: 'mv_essentials_box',    label: 'Label a first-night essentials box or bag',                                              track: 'moving_day', defaultPeriod: 'before_move_out' },
  { key: 'mv_special_needs',     label: 'Plan for children, pets, caregiving, work, or accessibility needs on moving day',        track: 'moving_day', defaultPeriod: 'moving_day' },
  { key: 'mv_valuables',         label: 'Plan handling for valuables, important documents, or fragile items',                     track: 'moving_day', defaultPeriod: 'moving_day' },
  { key: 'mv_contact_list',      label: 'Prepare a moving-day contact list',                                                      track: 'moving_day', defaultPeriod: 'moving_day' },
  { key: 'mv_loading_access',    label: 'Confirm loading and unloading access at both locations',                                  track: 'moving_day', defaultPeriod: 'moving_day' },
  { key: 'mv_inventory',         label: 'Create or review a high-value item inventory before the move',                           track: 'moving_day', defaultPeriod: 'before_move_out' },

  // ── Address, services, and administration ───────────────────────────────────
  { key: 'ad_mail_forward',      label: 'Plan and set up mail forwarding',                                                        track: 'general', defaultPeriod: 'before_move_out' },
  { key: 'ad_address_list',      label: 'Create an address-update list for organizations, employers, and contacts',               track: 'general', defaultPeriod: 'first_week' },
  { key: 'ad_internet',          label: 'Plan internet, cable, or streaming service changes',                                     track: 'general', defaultPeriod: 'before_move_out' },
  { key: 'ad_insurance_qs',      label: 'Record insurance questions for the appropriate professional',                            track: 'general', defaultPeriod: 'before_closing' },
  { key: 'ad_subscriptions',     label: 'Track memberships, deliveries, and recurring services to update',                       track: 'general', defaultPeriod: 'first_week' },
  { key: 'ad_notify_list',       label: 'Keep a list of organizations, agencies, and contacts to notify',                        track: 'general', defaultPeriod: 'first_week' },
  { key: 'ad_vehicle_reg',       label: 'Note vehicle registration or license update needs',                                      track: 'general', defaultPeriod: 'later' },
  { key: 'ad_voter_reg',         label: 'Note voter registration or other civic updates',                                         track: 'general', defaultPeriod: 'later' },

  // ── First week and settling in ──────────────────────────────────────────────
  { key: 'fw_unpack_essentials', label: 'Unpack essential rooms first (kitchen, bathroom, bedroom)',                              track: 'first_week', defaultPeriod: 'first_week' },
  { key: 'fw_safety_devices',    label: 'Check user-observed smoke detector, CO detector, and lock status',                      track: 'first_week', defaultPeriod: 'first_week' },
  { key: 'fw_manuals_keys',      label: 'Organize manuals, warranty documents, and access items',                                 track: 'first_week', defaultPeriod: 'first_week' },
  { key: 'fw_unresolved_qs',     label: 'Record unresolved property or service questions',                                        track: 'first_week', defaultPeriod: 'first_week' },
  { key: 'fw_service_visits',    label: 'Schedule chosen service visits or repairs',                                              track: 'first_week', defaultPeriod: 'first_week' },
  { key: 'fw_address_updates',   label: 'Complete remaining address updates not done at move',                                    track: 'first_week', defaultPeriod: 'first_week' },
  { key: 'fw_neighbor_intro',    label: 'Introduce yourself to neighbors or building contacts as appropriate',                    track: 'first_week', defaultPeriod: 'first_week' },
]

// Grouped by track for easy Stage 2 rendering
export const STARTER_TASKS_BY_TRACK = {
  closing_coordination: STARTER_TASKS.filter(t => t.track === 'closing_coordination'),
  leaving:              STARTER_TASKS.filter(t => t.track === 'leaving'),
  arriving:             STARTER_TASKS.filter(t => t.track === 'arriving'),
  moving_day:           STARTER_TASKS.filter(t => t.track === 'moving_day'),
  general:              STARTER_TASKS.filter(t => t.track === 'general'),
  first_week:           STARTER_TASKS.filter(t => t.track === 'first_week'),
}

export const STAGE2_SECTION_TITLES: Record<string, string> = {
  closing_coordination: 'Closing coordination',
  leaving:              'Leaving property',
  arriving:             'Arriving property',
  moving_day:           'Packing and moving day',
  general:              'Address, services, and administration',
  first_week:           'First week and settling in',
}
