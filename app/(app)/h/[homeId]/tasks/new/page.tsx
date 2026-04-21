import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerClient } from '@/lib/pocketbase-server';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TaskForm } from '@/components/forms/task-form';

/**
 * /h/[homeId]/tasks/new — task creation page.
 *
 * Supports `?areaId=<id>` query param for pre-selecting the area dropdown
 * when the user navigates here from an area detail page's "+ Add task"
 * link (CONTEXT §Specifics: "pre-selected if navigated from an area").
 *
 * Fetches the home + its active areas server-side and passes them as
 * props so the TaskForm Client Component can populate the Area select
 * without an extra client-side fetch.
 */
export default async function NewTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ homeId: string }>;
  searchParams: Promise<{ areaId?: string }>;
}) {
  const { homeId } = await params;
  const { areaId } = await searchParams;
  const pb = await createServerClient();

  let home;
  try {
    home = await pb.collection('homes').getOne(homeId, { fields: 'id,name' });
  } catch {
    notFound();
  }

  const areasRaw = await pb.collection('areas').getFullList({
    filter: `home_id = "${homeId}"`,
    sort: 'sort_order,name',
    fields: 'id,name',
  });
  const areas = areasRaw.map((a) => ({
    id: a.id,
    name: (a.name as string) ?? '',
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/h/${homeId}`}>← Back to {home.name as string}</Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>New task</CardTitle>
          <CardDescription>
            Name the task, pick an area, and set how often it repeats.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaskForm
            mode="create"
            homeId={homeId}
            areas={areas}
            preselectedAreaId={areaId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
