/**
 * CHIP Wallet E2E Tests
 * End-to-end tests for CHIP wallet functionality
 */

const { test, expect } = require('@playwright/test');

test.describe('CHIP Wallet E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Mock wallet connection
        await page.addInitScript(() => {
            window.mockWallet = {
                address: 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b',
                connected: true
            };
        });
    });
    
    test('should display CHIP balance', async ({ page }) => {
        // Mock API response
        await page.route('**/api/chip/balance/**', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({ success: true, balance: 1000000000 }) // 1000 CHIP
            });
        });
        
        await page.goto('/wallet');
        
        await expect(page.locator('.chip-balance')).toBeVisible();
        await expect(page.locator('.chip-balance')).toContainText('1,000');
    });
    
    test('should display staked amount', async ({ page }) => {
        await page.route('**/api/chip/info/**', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    success: true,
                    balance: 500000000,
                    stakedAmount: 500000000,
                    pendingReward: 25000000,
                    isVIP: true
                })
            });
        });
        
        await page.goto('/wallet');
        
        await expect(page.locator('.staked-amount')).toBeVisible();
        await expect(page.locator('.pending-reward')).toContainText('25');
    });
    
    test('should display VIP status badge', async ({ page }) => {
        await page.route('**/api/chip/info/**', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    success: true,
                    balance: 15000000000,
                    stakedAmount: 15000000000,
                    isVIP: true,
                    vipLevel: 2
                })
            });
        });
        
        await page.goto('/wallet');
        
        await expect(page.locator('.vip-badge')).toBeVisible();
        await expect(page.locator('.vip-benefits')).toBeVisible();
    });
    
    test('should stake CHIP tokens', async ({ page }) => {
        await page.route('**/api/chip/info/**', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    success: true,
                    balance: 5000000000,
                    stakedAmount: 0
                })
            });
        });
        
        await page.route('**/api/stake/stake', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    success: true,
                    stakedAmount: 1000000000,
                    lockEndTime: Date.now() + 30 * 24 * 60 * 60 * 1000
                })
            });
        });
        
        await page.goto('/wallet/stake');
        
        // Fill stake form
        await page.locator('#stakeAmount').fill('1000');
        await page.locator('#lockDuration').selectOption('30');
        
        // Submit
        await page.locator('.stake-btn').click();
        
        // Confirm
        await page.locator('.confirm-btn').click();
        
        // Wait for success
        await expect(page.locator('.stake-success')).toBeVisible({ timeout: 10000 });
    });
    
    test('should show penalty warning for early unstake', async ({ page }) => {
        await page.route('**/api/stake/info/**', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    success: true,
                    stakedAmount: 1000000000,
                    lockEndTime: Date.now() + 29 * 24 * 60 * 60 * 1000, // 29 days remaining
                    isLocked: true
                })
            });
        });
        
        await page.goto('/wallet/unstake');
        
        // Should show penalty warning
        await expect(page.locator('.penalty-warning')).toBeVisible();
        await expect(page.locator('.penalty-rate')).toContainText('10%');
    });
    
    test('should claim rewards', async ({ page }) => {
        await page.route('**/api/stake/pending/**', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    success: true,
                    pendingReward: 50000000 // 50 CHIP
                })
            });
        });
        
        await page.route('**/api/stake/claim', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    success: true,
                    claimedAmount: 50000000
                })
            });
        });
        
        await page.goto('/wallet');
        
        // Check pending reward
        await expect(page.locator('.pending-reward')).toContainText('50');
        
        // Claim
        await page.locator('.claim-reward-btn').click();
        await page.locator('.confirm-btn').click();
        
        // Wait for success
        await expect(page.locator('.claim-success')).toBeVisible({ timeout: 10000 });
    });
    
    test('should display transaction history', async ({ page }) => {
        await page.route('**/api/chip/history/**', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    success: true,
                    history: [
                        { type: 'REWARD', amount: 10000000, timestamp: Date.now() - 1000 },
                        { type: 'STAKE', amount: 500000000, timestamp: Date.now() - 86400000 },
                        { type: 'TRANSFER_IN', amount: 1000000000, timestamp: Date.now() - 172800000 }
                    ]
                })
            });
        });
        
        await page.goto('/wallet/history');
        
        await expect(page.locator('.transaction-list')).toBeVisible();
        await expect(page.locator('.transaction-item')).toHaveCount(3);
    });
    
    test('should transfer CHIP to another address', async ({ page }) => {
        await page.route('**/api/chip/balance/**', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({ success: true, balance: 5000000000 })
            });
        });
        
        await page.route('**/api/chip/transfer', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    success: true,
                    txHash: '0x123...',
                    amount: 100000000
                })
            });
        });
        
        await page.goto('/wallet/transfer');
        
        // Fill transfer form
        await page.locator('#recipient').fill('TPLRECIPIENT123456789ABCDEFGHIJKLMN');
        await page.locator('#amount').fill('100');
        
        // Submit
        await page.locator('.transfer-btn').click();
        await page.locator('.confirm-btn').click();
        
        // Wait for success
        await expect(page.locator('.transfer-success')).toBeVisible({ timeout: 10000 });
    });
    
    test('should show insufficient balance error', async ({ page }) => {
        await page.route('**/api/chip/balance/**', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({ success: true, balance: 50000000 }) // 50 CHIP
            });
        });
        
        await page.route('**/api/chip/transfer', route => {
            route.fulfill({
                status: 400,
                body: JSON.stringify({
                    success: false,
                    error: 'Insufficient balance'
                })
            });
        });
        
        await page.goto('/wallet/transfer');
        
        await page.locator('#recipient').fill('TPLRECIPIENT123456789ABCDEFGHIJKLMN');
        await page.locator('#amount').fill('100');
        
        await page.locator('.transfer-btn').click();
        await page.locator('.confirm-btn').click();
        
        // Should show error
        await expect(page.locator('.error-message')).toBeVisible();
        await expect(page.locator('.error-message')).toContainText('Insufficient');
    });
    
    test('should handle VIP discount display', async ({ page }) => {
        await page.route('**/api/chip/vip-discount/**', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    success: true,
                    discount: {
                        isVIP: true,
                        discountRate: 0.10,
                        rakeDiscount: 0.10,
                        benefits: ['10% rake discount', 'Priority support']
                    }
                })
            });
        });
        
        await page.goto('/wallet');
        
        await expect(page.locator('.vip-discount-rate')).toContainText('10%');
        await expect(page.locator('.vip-benefit')).toHaveCount(2);
    });
    
    test('should support pagination on transaction history', async ({ page }) => {
        let requestCount = 0;
        
        await page.route('**/api/chip/history/**', route => {
            requestCount++;
            const offset = parseInt(route.request().url().split('offset=')[1]?.split('&')[0] || '0');
            
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    success: true,
                    history: Array(20).fill(null).map((_, i) => ({
                        type: 'REWARD',
                        amount: 10000000,
                        timestamp: Date.now() - (offset + i) * 86400000
                    }))
                })
            });
        });
        
        await page.goto('/wallet/history');
        
        // First page
        await expect(page.locator('.transaction-item')).toHaveCount(20);
        
        // Load more
        await page.locator('.load-more-btn').click();
        
        // Should fetch next page
        expect(requestCount).toBeGreaterThan(1);
    });
});
