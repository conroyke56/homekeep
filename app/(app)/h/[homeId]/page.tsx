import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Plus } from 'lucide-react';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createServerClient } from '@/lib/pocketbase-server';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * /h/[homeId] — home dashboard.
 *
 * 02-04 scope: area tiles (icon + color + name) linking to /areas/[areaId].
 * 02-05 scope: + per-area task count (derived from pb.collection('tasks')
 *              grouped by area_id, archived=false only) + "+ Add task"
 *              quick-link at the top of the page.
 *
 * Next 16 async params contract: params: Promise<{ homeId }>.
 */

function kebabToPascal(s: string): string {
  return s
    .split('-')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : ''))
    .join('');
}

const IconModule = Icons as unknown as Record<string, LucideIcon | undefined>;

export default async function HomeDashboardPage({
  params,
}: {
  params: Promise<{ homeId: string }>;
}) {
  const { homeId } = await params;
  const pb = await createServerClient();

  let home;
  try {
    home = await pb.collection('homes').getOne(homeId, {
      fields: 'id,name,address',
    });
  } catch {
    notFound();
  }

  const [areas, allTasks] = await Promise.all([
    pb.collection('areas').getFullList({
      filter: `home_id = "${homeId}"`,
      sort: 'sort_order,name',
      fields: 'id,name,icon,color,is_whole_home_system,sort_order',
    }),
    pb.collection('tasks').getFullList({
      filter: `home_id = "${homeId}" && archived = false`,
      fields: 'id,area_id',
    }),
  ]);

  // Group active tasks by area_id for the per-tile count.
  const countByArea = new Map<string, number>();
  for (const t of allTasks) {
    const aid = t.area_id as string;
    countByArea.set(aid, (countByArea.get(aid) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{home.name as string}</h1>
          {home.address ? (
            <p className="text-sm text-muted-foreground">
              {home.address as string}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/h/${homeId}/tasks/new`}>
              <Plus className="mr-1 size-4" /> Add task
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/h/${homeId}/areas`}>Manage areas</Link>
          </Button>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Areas</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((a) => {
            const Icon =
              IconModule[kebabToPascal(String(a.icon ?? 'home'))] ??
              Icons.HelpCircle;
            const count = countByArea.get(a.id) ?? 0;
            return (
              <li key={a.id}>
                <Link href={`/h/${homeId}/areas/${a.id}`}>
                  <Card className="p-4 transition-colors hover:bg-muted">
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex size-8 items-center justify-center rounded-md text-white"
                        style={{ background: String(a.color ?? '#D4A574') }}
                        aria-hidden
                      >
                        <Icon className="size-4" />
                      </span>
                      <div className="flex-1 truncate">
                        <div className="font-medium">{a.name as string}</div>
                        <div className="text-xs text-muted-foreground">
                          {count === 0
                            ? 'No tasks yet'
                            : `${count} active task${count === 1 ? '' : 's'}`}
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
            <CardDescription>
              {allTasks.length === 0
                ? 'No active tasks yet — add your first one to get started.'
                : `${allTasks.length} active task${allTasks.length === 1 ? '' : 's'} across ${areas.length} area${areas.length === 1 ? '' : 's'}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The three-band “due-soon / due-today / overdue” view lands in
              Phase 3. For now, open an area to see its tasks.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
