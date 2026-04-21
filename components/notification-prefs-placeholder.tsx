'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * NotificationPrefsPlaceholder — Person view Section 4 stub (05-02 Task 2,
 * D-07, PERS-04).
 *
 * Phase 5 renders a disabled preview of the notification prefs form that
 * Phase 6 will wire to real ntfy + email-summary backends. Showing the
 * shape of the future surface lets users see it's coming without us
 * misrepresenting it as functional.
 *
 * Client Component — Input/Label are client primitives; disabled inputs
 * still need to mount through the client boundary for the form semantics.
 *
 * NO server interaction. NO server action wiring. All fields have
 * `disabled` — onChange handlers omitted so a future copy-paste into the
 * Phase 6 form can't accidentally leak state here.
 *
 * E2E anchor (`data-notification-prefs-placeholder`) and the literal
 * phrase "coming in Phase 6" let Suite C assert the stub is present
 * without matching on stylable copy.
 */
export function NotificationPrefsPlaceholder() {
  return (
    <Card data-notification-prefs-placeholder>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          Notification preferences arrive in Phase 6 — this section is a
          preview.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ntfy-topic">
            Your ntfy topic (coming in Phase 6)
          </Label>
          <Input
            id="ntfy-topic"
            name="ntfy_topic"
            placeholder="homekeep-alice-a7b3c9"
            disabled
          />
        </div>
        <div className="flex items-center gap-3">
          <Input
            id="email-summary"
            name="email_summary"
            type="checkbox"
            className="size-4 cursor-not-allowed"
            disabled
          />
          <Label htmlFor="email-summary" className="text-sm">
            Email summary (weekly recap)
          </Label>
        </div>
      </CardContent>
    </Card>
  );
}
