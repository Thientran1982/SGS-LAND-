
import { test, expect, type Page } from '@playwright/test';

/**
 *  E2E: CRITICAL PATH VERIFICATION (ENTERPRISE GRADE)
 * -----------------------------------------------------------------------------
 *  Refactored for CI/CD pipelines.
 *  
 *  Improvements:
 *  1. Configuration-driven Locators (Decoupled from UI text).
 *  2. Semantic Selectors (Roles/TestIDs over Placeholders).
 *  3. Dynamic Data Generation.
 *  4. Explicit Test Steps.
 * -----------------------------------------------------------------------------
 */

// --- 1. CONFIGURATION LAYER ---
const ENV = {
    BASE_URL: process.env.BASE_URL || 'http://localhost:5000',
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@sgs.vn',
    ADMIN_PASS: process.env.ADMIN_PASS || '',
    TIMEOUTS: {
        NAV: 15000,
        ACTION: 5000,
        ASSERT: 10000
    }
};

// --- 2. LOCATOR STRATEGY & UI DICTIONARY ---
// Maps concepts to UI strings or Selectors. 
// Ideally, these strings come from a shared translation file in a real build pipeline.
const LOCATORS = {
    LOGIN: {
        INPUT_EMAIL: 'input[type="email"]',
        INPUT_PASS: 'input[type="password"]',
        BTN_SUBMIT: 'button[type="submit"]'
    },
    NAV: {
        // Using aria-labels defined in the components
        BTN_LEADS: 'button[title="Leads"]', // Fallback if aria-label not present
        BTN_SYSTEM: 'button[title="System Status"]',
        BTN_DATA: 'button[title="Data Platform"]',
        // Text fallbacks
        TXT_LEADS: 'Khách hàng',
        TXT_SYSTEM: 'Hạ tầng',
        TXT_DATA: 'Dữ liệu nguồn'
    },
    LEADS: {
        BTN_ADD_NEW: 'Thêm mới', // Button text
        BTN_PROPOSAL_ICON: 'Báo giá', // Title attribute
        BTN_CREATE_PROPOSAL: 'Tạo báo giá',
        MODAL_SUBMIT: 'Thêm mới'
    },
    PUBLIC_PROPOSAL: {
        BTN_INTERESTED: 'Tôi quan tâm',
        TXT_PRICE: 'Giá niêm yết'
    }
};

// --- 3. UTILS & HELPERS ---
const generateLeadData = () => {
    const timestamp = Date.now();
    return {
        name: `E2E Lead ${timestamp}`,
        // Generate random 10-digit phone starting with 09
        phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`
    };
};

const login = async (page: Page) => {
    await test.step('Login Flow', async () => {
        // Wait for hydration/render
        await page.waitForSelector(LOCATORS.LOGIN.INPUT_EMAIL, { state: 'visible' });
        
        await page.locator(LOCATORS.LOGIN.INPUT_EMAIL).fill(ENV.ADMIN_EMAIL);
        await page.locator(LOCATORS.LOGIN.INPUT_PASS).fill(ENV.ADMIN_PASS);
        await page.locator(LOCATORS.LOGIN.BTN_SUBMIT).click();
        
        // Assertion: Check for Dashboard element or URL change
        await expect(page).toHaveURL(/dashboard/);
    });
};

// --- 4. TEST SUITE ---

test.describe('Critical Business Flows', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(ENV.BASE_URL);
    // Clear storage to ensure clean session state
    await page.evaluate(() => {
        window.localStorage.clear(); 
        window.sessionStorage.clear();
    });
    await page.reload();
  });

  test('Lead to Cash: Create Lead -> Create Proposal -> Public View', async ({ page, context }) => {
    const leadData = generateLeadData();

    await login(page);

    await test.step('Create New Lead', async () => {
        // Navigate
        await page.getByText(LOCATORS.NAV.TXT_LEADS).click();
        
        // Open Modal
        await page.getByRole('button', { name: LOCATORS.LEADS.BTN_ADD_NEW }).click();
        
        // Fill Form (Robust selectors: Type + Order or specific classes if IDs missing)
        const modal = page.locator('div[class*="fixed inset-0"]');
        await expect(modal).toBeVisible();
        
        // Assuming first text input is Name, second is Phone (based on Component structure)
        await modal.locator('input[type="text"]').first().fill(leadData.name);
        await modal.locator('input[value*="09"]').first().fill(leadData.phone); // Phone input has placeholder containing 09
        
        // Submit
        await modal.getByRole('button', { name: LOCATORS.LEADS.MODAL_SUBMIT }).click();
        
        // Verify
        await expect(page.locator(`text=${leadData.name}`)).toBeVisible();
    });

    let publicUrl = '';

    await test.step('Generate Flash Proposal', async () => {
        // 1. Find the row/card
        const leadCard = page.locator(`tr:has-text("${leadData.name}")`).first(); // Assuming Table View
        
        // 2. Click Proposal Button (Hover might be needed)
        // Force click allows bypassing hover states in tests
        await leadCard.getByTitle(LOCATORS.LEADS.BTN_PROPOSAL_ICON).click({ force: true });
        
        // 3. Select Listing (First available)
        const listingItem = page.locator('.bg-white.p-4').first();
        await listingItem.click();
        
        // 4. Confirm Creation
        await page.getByRole('button', { name: LOCATORS.LEADS.BTN_CREATE_PROPOSAL }).click();
        
        // 5. Extract Link
        const linkElement = page.locator('div.font-mono.text-xs.break-all'); // Specific class for the link
        await expect(linkElement).toBeVisible();
        
        const fullText = await linkElement.innerText();
        // Extract relative path /#/p/token
        const match = fullText.match(/#\/p\/[\w_]+/);
        if (!match) throw new Error("Proposal token not found in UI");
        publicUrl = match[0];
    });

    await test.step('Verify Public Proposal (Anonymous)', async () => {
        const publicPage = await context.newPage();
        await publicPage.goto(`${ENV.BASE_URL}/${publicUrl}`);
        
        // Assertions
        await expect(publicPage.getByRole('heading', { name: leadData.name })).toBeVisible();
        await expect(publicPage.getByText(LOCATORS.PUBLIC_PROPOSAL.TXT_PRICE)).toBeVisible();
        await expect(publicPage.getByRole('button', { name: LOCATORS.PUBLIC_PROPOSAL.BTN_INTERESTED })).toBeVisible();
        
        await publicPage.close();
    });
  });

  test('Chaos Resilience: UI Survival', async ({ page }) => {
      await login(page);

      await test.step('Enable Chaos Mode', async () => {
          await page.getByText(LOCATORS.NAV.TXT_SYSTEM).click();
          
          // Locate Chaos Toggle specifically
          const chaosSection = page.locator('div:has-text("Chaos Engineering")');
          const toggle = chaosSection.locator('input[type="checkbox"]');
          
          if (!(await toggle.isChecked())) {
              await toggle.check();
          }
      });

      await test.step('Trigger Risky Operation', async () => {
          await page.getByText(LOCATORS.NAV.TXT_DATA).click();
          
          // Force click sync button (might be multiple, grab first active)
          // Using CSS selector for "Sync" icon button approximation if text missing
          const syncBtn = page.locator('button:has(svg)').filter({ hasText: /Sync|Đồng bộ/ }).first();
          if (await syncBtn.count() > 0) {
             await syncBtn.click({ force: true });
          }
      });

      await test.step('Verify App Did Not Crash', async () => {
          // Check if key navigation elements still exist
          await expect(page.getByText(LOCATORS.NAV.TXT_DATA)).toBeVisible();
          
          // Check for Toast (Error or Success are both acceptable, just not a white screen)
          const toast = page.locator('.fixed.top-6.right-6');
          await expect(toast).toBeVisible({ timeout: 5000 });
      });
  });

});
