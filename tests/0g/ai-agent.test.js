#!/usr/bin/env node
/**
 * AI Agent Communication Protocol Test (Python side)
 * Tests that the Python decision engine responds correctly via stdin/stdout.
 *
 * Run: python3 tests/0g/ai-agent.test.py  (or from Node)
 */

const { spawn } = require('child_process');
const path = require('path');

// Test cases for the AI engine communication protocol
const TEST_CASES = [
    {
        name: 'ping command',
        input: JSON.stringify({ request_id: 't1', command: 'ping' }),
        expectContains: ['pong', 't1']
    },
    {
        name: 'fold decision',
        input: JSON.stringify({
            request_id: 't2',
            command: 'request_action',
            hand: ['2s', '7d'],
            board: [],
            pot: 100,
            callAmount: 20,
            stack: 1000,
            position: 'BTN',
            difficulty: 'easy'
        }),
        expectContains: ['action']
    },
    {
        name: 'raise decision hard mode',
        input: JSON.stringify({
            request_id: 't3',
            command: 'request_action',
            hand: ['Ah', 'Kd'],
            board: ['Qh', 'Jh', 'Th'],
            pot: 500,
            callAmount: 50,
            stack: 2000,
            position: 'CO',
            difficulty: 'hard'
        }),
        expectContains: ['action', 'confidence']
    },
    {
        name: 'shutdown command',
        input: JSON.stringify({ request_id: 't4', command: 'shutdown' }),
        expectContains: ['shutdown', 't4']
    }
];

async function runTests() {
    console.log('=== AI Agent Communication Protocol Tests ===\n');

    const aiScript = path.resolve(__dirname, '../../ai_engine/decision_engine.py');
    
    let passed = 0;
    let failed = 0;

    for (const tc of TEST_CASES) {
        console.log(`[TEST] ${tc.name}`);

        try {
            const child = spawn('python3', [aiScript, '--worker'], {
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: 30000
            });

            let output = '';
            let errors = '';
            
            child.stdout.on('data', (data) => { output += data.toString(); });
            child.stderr.on('data', (data) => { errors += data.toString(); });

            // Wait for ready signal
            await new Promise((resolve) => {
                const checkReady = setInterval(() => {
                    if (output.includes('"ready"')) {
                        clearInterval(checkReady);
                        resolve();
                    }
                }, 200);

                setTimeout(() => { clearInterval(checkReady); resolve(); }, 15000);
            });

            // Send test input
            child.stdin.write(tc.input + '\n');

            // Wait for response
            await new Promise((resolve) => setTimeout(resolve, tc.name === 'shutdown' ? 2000 : 3000));

            child.kill();

            // Validate response
            let allPassed = true;
            for (const expected of tc.expectContains) {
                if (!output.includes(expected)) {
                    console.log(`  ✗ Missing expected: "${expected}"`);
                    console.log(`    Output: ${output.slice(-200)}`);
                    allPassed = false;
                }
            }

            if (allPassed) {
                console.log(`  ✓ PASSED`);
                passed++;
            } else {
                failed++;
            }

            if (errors && !errors.includes('Preloading')) {
                console.log(`  stderr: ${errors.slice(-100)}`);
            }
        } catch (err) {
            console.log(`  ✗ ERROR: ${err.message}`);
            failed++;
        }
        console.log('');
    }

    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
