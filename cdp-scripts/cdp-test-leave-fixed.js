const CDP = require('chrome-remote-interface');

async function test() {
  let client;
  try {
    const targets = await CDP.List();
    const gameTab = targets.find(t => t.url.includes('192.168.10.46:3000'));

    if (!gameTab) {
      console.log('❌ No game tab found at localhost:3000');
      return;
    }

    client = await CDP({ target: gameTab });
    const { Runtime, Page } = client;
    await Runtime.enable();
    await Page.enable();

    console.log('✅ Connected to game tab');

    // Check current page
    const currentUrl = await Runtime.evaluate({
      expression: 'window.location.href'
    });
    console.log('Current URL:', currentUrl.result.value);

    // If on home page, click Enter Game
    if (currentUrl.result.value.includes('localhost:3000/') && !currentUrl.result.value.includes('/play')) {
      console.log('📍 On home page, clicking Enter Game...');

      await Runtime.evaluate({
        expression: `
          const enterBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Enter Game'));
          if (enterBtn) {
            enterBtn.click();
            'clicked';
          } else {
            'not found';
          }
        `
      });

      // Wait for navigation to /play
      await new Promise(resolve => setTimeout(resolve, 3000));

      const newUrl = await Runtime.evaluate({
        expression: 'window.location.href'
      });
      console.log('After Enter Game:', newUrl.result.value);
    }

    // Wait for player info to appear
    console.log('⏳ Waiting for player info on table...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const playerInfo = await Runtime.evaluate({
      expression: `
        const seatName = document.querySelector('.seat-name');
        seatName ? seatName.textContent : 'not found';
      `
    });
    console.log('Player info:', playerInfo.result.value);

    // Click Leave button
    console.log('🚪 Clicking Leave button...');
    const leaveResult = await Runtime.evaluate({
      expression: `
        const leaveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Leave'));
        if (leaveBtn) {
          leaveBtn.click();
          'clicked';
        } else {
          'not found';
        }
      `
    });
    console.log('Leave button:', leaveResult.result.value);

    // Wait for navigation back to home
    await new Promise(resolve => setTimeout(resolve, 5000));

    const finalUrl = await Runtime.evaluate({
      expression: 'window.location.href'
    });
    console.log('After Leave:', finalUrl.result.value);

    console.log('✅ Test complete. Check server log for locked=0');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

test();
