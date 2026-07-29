export const DRILL_CARD_KEYS = [
    'today_received', 'today_finished', 'today_delivered', 'today_collected',
    'week_received', 'week_finished', 'week_delivered', 'week_collected',
    'month_received', 'month_finished', 'month_delivered', 'month_collected',
    'global_all', 'global_pending', 'global_in_progress',
    'global_waiting_parts', 'global_waiting_approval',
    'global_finished', 'global_delivered',
] as const;

export type DrillCardKey = (typeof DRILL_CARD_KEYS)[number];