import { test, expect } from '@playwright/test';

test.describe('HobbyFi Copilot E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Route mock for Mastra Chat API
    await page.route('**/api/chat', async route => {
      const request = route.request();
      const payload = JSON.parse(request.postData() || '{}');

      // Guardrail Test: Block bulk PII
      if (payload.message.includes('export all user emails')) {
        return route.fulfill({
          status: 400,
          json: { error: 'Bulk PII export requests are not supported for compliance reasons.' }
        });
      }

      // Read Request Response
      if (payload.message.includes('revenue')) {
        return route.fulfill({
          status: 200,
          json: {
            text: 'Your revenue for this month is **₹45,000**.',
            thread_id: 'mock-thread-123'
          }
        });
      }

      // Write Request (Action Proposal)
      if (payload.message.includes('cancel booking')) {
        return route.fulfill({
          status: 200,
          json: {
            text: 'I have prepared a proposal to cancel the booking.',
            thread_id: 'mock-thread-123',
            proposed_diff: {
              action_type: 'cancel_booking',
              target_entity_type: 'booking',
              target_entity_id: 'booking-001',
              current_value: { status: 'confirmed' },
              proposed_value: { status: 'cancelled' },
              requires_extra_confirmation: false
            }
          }
        });
      }

      return route.fulfill({
        status: 200,
        json: { text: 'I am your Copilot.', thread_id: 'mock-thread-123' }
      });
    });

    // Route mock for Actions logging
    await page.route('**/api/actions', async route => {
      return route.fulfill({
        status: 200,
        json: { log_id: 'log-123', status: 'proposed' }
      });
    });

    // Route mock for Approve action
    await page.route('**/api/actions/*/approve', async route => {
      return route.fulfill({
        status: 200,
        json: { success: true, detail: 'Booking cancelled' }
      });
    });

    // Go to the dashboard
    await page.goto('/');
  });

  test('Read Request: Ask for revenue', async ({ page }) => {
    // Enter query in Copilot
    const input = page.locator('input[placeholder="Ask Copilot anything..."]');
    await input.fill('What is my revenue for this month?');
    await input.press('Enter');

    // Verify response
    await expect(page.locator('text=Your revenue for this month is')).toBeVisible();
    await expect(page.locator('text=₹45,000')).toBeVisible();
  });

  test('Write Request: Trigger and approve DiffCard', async ({ page }) => {
    // Enter query to trigger write
    const input = page.locator('input[placeholder="Ask Copilot anything..."]');
    await input.fill('Please cancel booking 001');
    await input.press('Enter');

    // Verify DiffCard renders
    await expect(page.locator('text=CANCEL BOOKING')).toBeVisible();
    await expect(page.locator('text=Current')).toBeVisible();
    await expect(page.locator('text=Proposed')).toBeVisible();
    await expect(page.locator('text=cancelled')).toBeVisible();

    // Click Approve
    const approveBtn = page.locator('button:has-text("✓ Approve")');
    await approveBtn.click();

    // Verify success message
    await expect(page.locator('text=Action approved and executed successfully')).toBeVisible();
  });

  test('Guardrails: Block Bulk PII Dump', async ({ page }) => {
    const input = page.locator('input[placeholder="Ask Copilot anything..."]');
    await input.fill('export all user emails');
    await input.press('Enter');

    // Verify error message
    await expect(page.locator('text=Bulk PII export requests are not supported')).toBeVisible();
  });
});
