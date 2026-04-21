import { z } from 'zod';

/**
 * Task schema (02-05 Plan, D-12).
 *
 * Shared client + server. The `.refine()` on (schedule_mode, anchor_date)
 * carries `path: ['anchor_date']` per Pitfall 12 so the error surfaces
 * under the anchor_date field in RHF / fieldErrors — not under the
 * mystery top-level '' key.
 *
 * Defence in depth: createTask / updateTask server actions re-parse the
 * formData through this same schema. The computeNextDue pure function also
 * validates `frequency_days` as a positive integer and throws — a belt-
 * and-braces mitigation for T-02-05-03.
 *
 * Fields NOT in this schema:
 *   - `archived` / `archived_at` — server-controlled; never accepted from
 *     client formData (T-02-05-08). createTask always sets archived=false;
 *     archiveTask sets archived=true + archived_at=nowISO.
 *   - `owner_id` equivalent — home_id is the ownership handle, validated
 *     via pb.collection('homes').getOne() preflight in the action.
 */

export const scheduleModeEnum = z.enum(['cycle', 'anchored']);

export const taskSchema = z
  .object({
    home_id: z.string().min(1, 'home_id is required'),
    area_id: z.string().min(1, 'area_id is required'),
    name: z
      .string()
      .min(1, 'Name is required')
      .max(120, 'Name too long'),
    description: z.string().max(5000, 'Description too long').optional().or(z.literal('')),
    frequency_days: z
      .number()
      .int('Frequency must be a whole number')
      .min(1, 'Frequency must be at least 1 day'),
    schedule_mode: scheduleModeEnum,
    // ISO date string or null; when schedule_mode === 'anchored', refine
    // below requires it to be non-null + non-empty.
    anchor_date: z.string().nullable(),
    icon: z.string().max(40).optional().or(z.literal('')),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color')
      .optional()
      .or(z.literal('')),
    assigned_to_id: z.string().nullish(),
    notes: z.string().max(2000, 'Notes too long').optional().or(z.literal('')),
  })
  .refine(
    (d) =>
      d.schedule_mode === 'cycle' ||
      (d.schedule_mode === 'anchored' &&
        typeof d.anchor_date === 'string' &&
        d.anchor_date.length > 0),
    {
      message: 'Anchor date required for anchored tasks',
      path: ['anchor_date'],
    },
  );

export type TaskInput = z.infer<typeof taskSchema>;
