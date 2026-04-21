import { test, expect, type Page } from '@playwright/test';

/**
 * D-21 Phase 3 core-loop E2E (03-03 Plan Task 3).
 *
 * Two scenarios cover the entire tap-to-complete flow end-to-end:
 *
 * Scenario 1 — early-completion guard fires on a just-created task
 *   1. Signup new user -> empty /h.
 *   2. Create home "TestHouse".
 *   3. Add Kitchen area. Add Weekly (7d cycle) task "Wipe benches".
 *   4. Navigate back to /h/[homeId] — task appears in the This Week
 *      band (nextDue is 7 days out from creation).
 *   5. Tap the task row.
 *   6. Guard dialog appears (task just created, 0 days elapsed, far
 *      under the 25% threshold of 1.75 days).
 *   7. Click "Mark done anyway" -> sonner toast fires -> task
 *      disappears from This Week band.
 *   8. Reload -> task still absent from This Week (persisted).
 *
 * Scenario 2 — stale task in Overdue, no guard fires
 *   1. Separate user signup + home + Kitchen area + Weekly task
 *      "Clean filter".
 *   2. Seed a back-dated completion 10 days ago via the PB REST API.
 *      We auth against PB directly (port 8090) using the same email/
 *      password that created the user — the Next.js pb_auth cookie is
 *      HttpOnly and scoped to :3001, so we get a fresh token from PB.
 *   3. Reload /h/[homeId] — task is now in Overdue (10d ago + 7d freq
 *      = 3d overdue).
 *   4. Tap the task -> NO dialog (elapsed 10d >> 25% of 7d = 1.75d).
 *   5. Toast fires -> task moves out of Overdue.
 *   6. Reload -> state persisted.
 *
 * Flake mitigations (from 02-05 + tasks-happy-path lessons):
 *   - Unique email per scenario via Date.now() + random suffix.
 *   - URL-assertion pacing rather than arbitrary timeouts.
 *   - Sonner toast assertion tolerates the 5s default display.
 *   - Reload uses page.goto(homeUrl) rather than page.reload() in
 *     the persistence-check step to force a fresh Server Component
 *     render (defense against a stale router cache).
 */

const PB_URL = 'http://127.0.0.1:8090';

async function signup(page: Page, email: string, pw: string, name = 'Core Loop Test') {
  await page.goto('/signup');
  await page.fill('[name=name]', name);
  await page.fill('[name=email]', email);
  await page.fill('[name=password]', pw);
  await page.fill('[name=passwordConfirm]', pw);
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/\/h$/);
}

async function createHomeAndKitchen(page: Page, homeName: string): Promise<string> {
  await page.click('text=Create your first home');
  await expect(page).toHaveURL(/\/h\/new$/);
  await page.fill('[name=name]', homeName);
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/\/h\/[a-z0-9]+$/);
  const homeUrl = page.url();

  await page.click('text=Manage areas');
  await expect(page).toHaveURL(/\/h\/[a-z0-9]+\/areas$/);
  await page.click('text=Add area');
  await page.fill('[name=name]', 'Kitchen');
  await page.click('button:has-text("Create area")');
  await expect(page.locator('[data-area-name="Kitchen"]').first()).toBeVisible();
  return homeUrl;
}

async function createWeeklyTaskInKitchen(page: Page, homeUrl: string, taskName: string) {
  // Navigate into the Kitchen area (hub for the "Add task" link).
  await page.goto(homeUrl + '/areas');
  const kitchenRow = page.locator('[data-area-name="Kitchen"]').first();
  await kitchenRow.getByRole('link', { name: 'Kitchen' }).click();
  await expect(page).toHaveURL(/\/h\/[a-z0-9]+\/areas\/[a-z0-9]+$/);

  await page.click('text=Add task');
  await expect(page).toHaveURL(/\/h\/[a-z0-9]+\/tasks\/new/);
  await page.fill('[name=name]', taskName);
  await page.click('button:has-text("Weekly")');
  await page.click('button:has-text("Create task")');
  // Redirected back to the Kitchen area page.
  await expect(page).toHaveURL(/\/h\/[a-z0-9]+\/areas\/[a-z0-9]+$/);
}

test.describe('Phase 3 Core Loop (D-21)', () => {
  test('Scenario 1 — just-created task triggers early-completion guard -> accept -> moves out of This Week', async ({
    page,
  }) => {
    const email = `core-s1-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.com`;
    const pw = 'password123';
    await signup(page, email, pw);

    const homeUrl = await createHomeAndKitchen(page, 'TestHouseS1');
    await createWeeklyTaskInKitchen(page, homeUrl, 'Wipe benches');

    // Navigate to the home dashboard (BandView).
    await page.goto(homeUrl);
    await expect(page.locator('[data-band-view]')).toBeVisible();

    // Task lives in the This Week band (nextDue ~7d from creation).
    const taskInThisWeek = page.locator(
      '[data-band="thisWeek"] [data-task-name="Wipe benches"]',
    );
    await expect(taskInThisWeek).toBeVisible();

    // Coverage ring renders.
    await expect(page.locator('[role="img"][aria-label^="Coverage"]')).toBeVisible();

    // Tap the row -> early-completion guard fires.
    await taskInThisWeek.click();

    const dialog = page.locator('[data-testid="early-completion-dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/Mark done anyway/);

    // Confirm.
    await page.click('[data-testid="guard-confirm"]');

    // Sonner success toast appears.
    await expect(
      page.getByText(/Done — next due/),
    ).toBeVisible({ timeout: 5000 });

    // Task moved OUT of This Week band (it's ~7 days out again).
    await expect(
      page.locator('[data-band="thisWeek"] [data-task-name="Wipe benches"]'),
    ).toHaveCount(0);

    // Reload (fresh Server Component render) — state persists.
    await page.goto(homeUrl);
    await expect(page.locator('[data-band-view]')).toBeVisible();
    await expect(
      page.locator('[data-band="thisWeek"] [data-task-name="Wipe benches"]'),
    ).toHaveCount(0);
  });

  test('Scenario 2 — stale task in Overdue -> tap -> no guard -> moves out of Overdue', async ({
    page,
    request,
  }) => {
    const email = `core-s2-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.com`;
    const pw = 'password123';
    await signup(page, email, pw);

    const homeUrl = await createHomeAndKitchen(page, 'TestHouseS2');
    await createWeeklyTaskInKitchen(page, homeUrl, 'Clean filter');

    await page.goto(homeUrl);
    await expect(page.locator('[data-band-view]')).toBeVisible();

    // Extract the task id from the DOM (data-task-id on the row button).
    const taskRow = page
      .locator('[data-task-name="Clean filter"]')
      .first();
    await expect(taskRow).toBeVisible();
    const taskId = await taskRow.getAttribute('data-task-id');
    if (!taskId) throw new Error('Could not read task id from DOM');

    // Auth against PB directly (loopback :8090) to get a token scoped to
    // this user. The Next pb_auth cookie is HttpOnly + same-origin to
    // :3001, so we use the SDK's direct auth endpoint.
    const authRes = await request.post(
      `${PB_URL}/api/collections/users/auth-with-password`,
      {
        data: { identity: email, password: pw },
      },
    );
    expect(authRes.ok()).toBeTruthy();
    const auth = await authRes.json();
    const token = auth.token as string;
    const userId = auth.record?.id as string;
    expect(token).toBeTruthy();
    expect(userId).toBeTruthy();

    // Seed a back-dated completion ten days ago. PB completions.createRule
    // requires @request.body.completed_by_id = @request.auth.id, so we MUST
    // send userId as completed_by_id.
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
    const createRes = await request.post(
      `${PB_URL}/api/collections/completions/records`,
      {
        headers: { Authorization: token },
        data: {
          task_id: taskId,
          completed_by_id: userId,
          completed_at: tenDaysAgo,
          via: 'manual-date',
          notes: '',
        },
      },
    );
    expect(createRes.ok()).toBeTruthy();

    // Reload -> the task's nextDue now = tenDaysAgo + 7d = 3 days ago,
    // so it lands in the Overdue band.
    await page.goto(homeUrl);
    await expect(page.locator('[data-band-view]')).toBeVisible();
    const overdueRow = page.locator(
      '[data-band="overdue"] [data-task-name="Clean filter"]',
    );
    await expect(overdueRow).toBeVisible();

    // Tap -> no guard dialog (elapsed 10d > 0.25 * 7d = 1.75d).
    await overdueRow.click();

    // Guard dialog MUST NOT open.
    await expect(
      page.locator('[data-testid="early-completion-dialog"]'),
    ).toHaveCount(0);

    // Toast fires.
    await expect(
      page.getByText(/Done — next due/),
    ).toBeVisible({ timeout: 5000 });

    // Task moved out of Overdue.
    await expect(
      page.locator('[data-band="overdue"] [data-task-name="Clean filter"]'),
    ).toHaveCount(0);

    // Reload — state persisted.
    await page.goto(homeUrl);
    await expect(page.locator('[data-band-view]')).toBeVisible();
    await expect(
      page.locator('[data-band="overdue"] [data-task-name="Clean filter"]'),
    ).toHaveCount(0);
  });
});
