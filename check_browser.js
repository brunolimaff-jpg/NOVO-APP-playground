import { chromium } from 'playwright';

(async () => {
  console.log('Starting Playwright...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const errors = [];
  page.on('pageerror', error => {
    console.error('PAGE ERROR =>', error.message);
    errors.push(error.message);
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('CONSOLE ERROR =>', msg.text());
      errors.push(msg.text());
    }
  });

  try {
    console.log('Navigating to http://localhost:4173...');
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
    console.log('Page loaded successfully. Checking for errors...');
  } catch (err) {
    console.error('Navigation error:', err);
  }

  await browser.close();
  console.log('Done, found', errors.length, 'errors.');
})();
