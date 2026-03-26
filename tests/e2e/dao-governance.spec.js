/**
 * DAO Governance E2E Tests
 * End-to-end tests for DAO voting and proposals
 */

const { test, expect } = require('@playwright/test');

test.describe('DAO Governance E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.mockWallet = {
                address: 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b',
                connected: true,
                chipBalance: 5000000000 // 5000 CHIP
            };
        });
    });
    
    test('should display proposal list', async ({ page }) => {
        await page.route('**/api/dao/proposals', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    success: true,
                    proposals: [
                        { _id: '1', proposalType: 'RAKE_RATE', state: 'ACTIVE', description: 'Reduce rake' },
                        { _id: '2', proposalType: 'GENERAL', state: 'ACTIVE', description: 'Add new feature' }
                    ]
                })
            });
        });
        
        await page.goto('/dao');
        
        await expect(page.locator('.proposal-list')).toBeVisible();
        await expect(page.locator('.proposal-card')).toHaveCount(2);
    });
    
    test('should filter proposals by status', async ({ page }) => {
        await page.route('**/api/dao/proposals?status=active', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    success: true,
                    proposals: [
                        { _id: '1', state: 'ACTIVE' }
                    ]
                })
            });
        });
        
        await page.goto('/dao');
        
        await page.locator('.status-filter').selectOption('active');
        
        await expect(page.locator('.proposal-card')).toHaveCount(1);
    });
    
    test('should create new proposal', async ({ page }) => {
        await page.route('**/api/dao/proposal', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    success: true,
                    proposal: {
                        _id: 'new_1',
                        proposalType: 'RAKE_RATE',
                        state: 'ACTIVE',
                        description: 'Reduce rake to 3%'
                    }
                })
            });
        });
        
        await page.goto('/dao/create');
        
        // Fill form
        await page.locator('#proposalType').selectOption('RAKE_RATE');
        await page.locator('#description').fill('建议将抽水比例从5%降低到3%');
        await page.locator('#newRate').fill('300');
        
        // Submit
        await page.locator('.submit-btn').click();
        
        // Wait for success
        await expect(page.locator('.proposal-created')).toBeVisible({ timeout: 10000 });
    });
    
    test('should show proposal threshold requirement', async ({ page }) => {
        await page.addInitScript(() => {
            window.mockWallet = {
                address: 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b',
                connected: true,
                chipBalance: 500000000 // Only 500 CHIP
            };
        });
        
        await page.goto('/dao/create');
        
        // Should show threshold warning
        await expect(page.locator('.threshold-warning')).toBeVisible();
        await expect(page.locator('.threshold-warning')).toContainText('1000');
    });
    
    test('should display proposal details', async ({ page }) => {
        await page.route('**/api/dao/proposal/1', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    success: true,
                    proposal: {
                        _id: '1',
                        proposalType: 'RAKE_RATE',
                        description: 'Reduce rake to 3%',
                        state: 'ACTIVE',
                        forVotes: 5000000000,
                        againstVotes: 1000000000,
                        endTime: Date.now() + 86400000
                    }
                })
            });
        });
        
        await page.route('**/api/dao/proposal/1/votes', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    success: true,
                    forVotes: 5000000000,
                    againstVotes: 1000000000,
                    abstainVotes: 500000000,
                    quorumReached: true
                })
            });
        });
        
        await page.goto('/dao/proposal/1');
        
        await expect(page.locator('.proposal-detail')).toBeVisible();
        await expect(page.locator('.vote-progress')).toBeVisible();
        await expect(page.locator('.quorum-progress')).toBeVisible();
    });
    
    test('should cast vote for proposal', async ({ page }) => {
        await page.route('**/api/dao/proposal/1/voted/**', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({ success: true, hasVoted: false })
            });
        });
        
        await page.route('**/api/dao/proposal/1/vote', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    success: true,
                    vote: {
                        support: 1,
                        weight: 5000000000
                    }
                })
            });
        });
        
        await page.goto('/dao/proposal/1');
        
        // Click vote for
        await page.locator('.vote-for-btn').click();
        
        // Confirm
        await page.locator('.confirm-vote').click();
        
        // Wait for success
        await expect(page.locator('.vote-success')).toBeVisible({ timeout: 10000 });
    });
    
    test('should show already voted state', async ({ page }) => {
        await page.route('**/api/dao/proposal/1/voted/**', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({ success: true, hasVoted: true })
            });
        });
        
        await page.goto('/dao/proposal/1');
        
        // Should show voted state
        await expect(page.locator('.already-voted')).toBeVisible();
    });
    
    test('should handle vote with reason', async ({ page }) => {
        await page.route('**/api/dao/proposal/1/vote', route => {
            const body = route.request().postDataJSON();
            expect(body.reason).toBeTruthy();
            
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    success: true,
                    vote: { support: 1, weight: 5000000000, reason: body.reason }
                })
            });
        });
        
        await page.goto('/dao/proposal/1');
        
        await page.locator('.vote-for-btn').click();
        await page.locator('#voteReason').fill('This will benefit all players');
        await page.locator('.confirm-vote').click();
        
        await expect(page.locator('.vote-success')).toBeVisible({ timeout: 10000 });
    });
    
    test('should display voting results after end', async ({ page }) => {
        await page.route('**/api/dao/proposal/1', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    success: true,
                    proposal: {
                        _id: '1',
                        state: 'SUCCEEDED',
                        forVotes: 8000000000,
                        againstVotes: 2000000000,
                        quorumReached: true,
                        endTime: Date.now() - 1000
                    }
                })
            });
        });
        
        await page.goto('/dao/proposal/1');
        
        await expect(page.locator('.proposal-result')).toBeVisible();
        await expect(page.locator('.result-passed')).toBeVisible();
    });
    
    test('should show execute button for passed proposal', async ({ page }) => {
        await page.route('**/api/dao/proposal/1', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    success: true,
                    proposal: {
                        _id: '1',
                        state: 'SUCCEEDED',
                        quorumReached: true,
                        endTime: Date.now() - 1000
                    }
                })
            });
        });
        
        await page.route('**/api/dao/proposal/1/execute', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    success: true,
                    state: 'EXECUTED',
                    txHash: '0x123...'
                })
            });
        });
        
        await page.goto('/dao/proposal/1');
        
        // Execute button should be visible
        await expect(page.locator('.execute-btn')).toBeVisible();
        
        // Execute
        await page.locator('.execute-btn').click();
        
        await expect(page.locator('.execution-success')).toBeVisible({ timeout: 10000 });
    });
    
    test('should show user proposals', async ({ page }) => {
        await page.route('**/api/dao/proposals/by/**', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    success: true,
                    proposals: [
                        { _id: '1', proposerAddress: 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b' },
                        { _id: '2', proposerAddress: 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b' }
                    ]
                })
            });
        });
        
        await page.goto('/dao/my-proposals');
        
        await expect(page.locator('.proposal-card')).toHaveCount(2);
    });
    
    test('should handle no voting power error', async ({ page }) => {
        await page.addInitScript(() => {
            window.mockWallet = {
                address: 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b',
                connected: true,
                chipBalance: 0
            };
        });
        
        await page.route('**/api/dao/proposal/1/vote', route => {
            route.fulfill({
                status: 400,
                body: JSON.stringify({
                    success: false,
                    error: 'No voting power'
                })
            });
        });
        
        await page.goto('/dao/proposal/1');
        
        await page.locator('.vote-for-btn').click();
        await page.locator('.confirm-vote').click();
        
        await expect(page.locator('.error-message')).toContainText('No voting power');
    });
    
    test('should show quorum progress bar', async ({ page }) => {
        await page.route('**/api/dao/proposal/1/votes', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    success: true,
                    forVotes: 5000000000,
                    againstVotes: 1000000000,
                    abstainVotes: 500000000,
                    totalVotes: 6500000000,
                    quorumRequired: 10000000000,
                    quorumReached: false
                })
            });
        });
        
        await page.goto('/dao/proposal/1');
        
        // Quorum not reached
        await expect(page.locator('.quorum-progress')).toBeVisible();
        await expect(page.locator('.quorum-status')).toContainText('65%');
    });
});
