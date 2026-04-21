import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createServerClient } from '@/lib/pocketbase-server';
import { assertOwnership } from '@/lib/membership';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HomeForm } from '@/components/forms/home-form';
import {
  InviteLinkCard,
  type PendingInvite,
} from '@/components/invite-link-card';
import { DeleteHomeButton } from '@/components/delete-home-button';

/**
 * /h/[homeId]/settings — owner-gated settings route (04-03 D-16).
 *
 * Sections:
 *   1. Home details (name / address / timezone) via HomeForm mode="edit"
 *   2. Invite a member (InviteLinkCard — createInvite + pending-invites list)
 *   3. Danger zone — Delete home (04-03)
 *
 * Non-owner access: redirect to /h/[homeId] (the home dashboard). We
 * intentionally don't 403 — membership is fine, they just don't have
 * permission to view settings. notFound() is reserved for genuinely
 * bogus home ids (the getOne below).
 */
export default async function HomeSettingsPage({
  params,
}: {
  params: Promise<{ homeId: string }>;
}) {
  const { homeId } = await params;
  const pb = await createServerClient();

  try {
    await assertOwnership(pb, homeId);
  } catch {
    redirect(`/h/${homeId}`);
  }

  let home;
  try {
    home = await pb.collection('homes').getOne(homeId, {
      fields: 'id,name,address,timezone',
    });
  } catch {
    notFound();
  }

  // PB empty-date filter uses the empty string. Owner can list invites
  // for their home (invites.listRule is owner-only).
  const pendingInvitesRaw = await pb.collection('invites').getFullList({
    filter: `home_id = "${homeId}" && accepted_at = ""`,
    sort: '-created',
    fields: 'id,token,expires_at,created',
  });
  const pendingInvites: PendingInvite[] = pendingInvitesRaw.map((i) => ({
    id: i.id,
    token: i.token as string,
    expiresAt: i.expires_at as string,
    created: i.created as string,
  }));

  const homeName = (home.name as string) ?? 'Home';

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/h/${homeId}`}>← Back to {homeName}</Link>
      </Button>

      <h1 className="text-xl font-semibold">{homeName} — Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Home details</CardTitle>
          <CardDescription>
            Name, address, and timezone. Timezone drives band
            classification + completion recency.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HomeForm
            mode="edit"
            home={{
              id: home.id,
              name: (home.name as string) ?? '',
              address: (home.address as string) ?? undefined,
              timezone: (home.timezone as string) ?? 'UTC',
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            Invite people to share this home or manage existing members.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <InviteLinkCard homeId={homeId} pendingInvites={pendingInvites} />
          <Button asChild variant="outline" className="w-full">
            <Link href={`/h/${homeId}/members`}>View members</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>
            Deletes the home, its areas, and tasks for every member.
            Irreversible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteHomeButton homeId={homeId} homeName={homeName} />
        </CardContent>
      </Card>
    </main>
  );
}
