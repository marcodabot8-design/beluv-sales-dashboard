const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const appDir = __dirname;
const indexHtml = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
const cloudJs = fs.readFileSync(path.join(appDir, 'cloud.js'), 'utf8');
const appJs = fs.readFileSync(path.join(appDir, 'app.js'), 'utf8');

async function run() {
  const dom = new JSDOM(indexHtml, {
    url: 'http://127.0.0.1:8033',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.BELUV_CONFIG = { supabaseUrl: '', supabaseAnonKey: '' };
      window.supabase = {};
      window.alert = () => {};
      window.confirm = () => true;
      window.HTMLElement.prototype.scrollIntoView = () => {};
    },
  });

  const { window } = dom;
  window.eval(cloudJs);
  window.eval(appJs);

  await new Promise((resolve) => setTimeout(resolve, 20));

  const syncMode = window.document.querySelector('#syncModePill')?.textContent?.trim();
  const authMessage = window.document.querySelector('#authMessage')?.textContent?.trim();
  const metricDmsSentBefore = window.document.querySelector('#metricDmsSent')?.textContent?.trim();

  if (syncMode !== 'local mode') throw new Error(`expected local mode, got: ${syncMode}`);
  if (!authMessage.includes('local mode')) throw new Error(`expected local-mode auth message, got: ${authMessage}`);
  if (metricDmsSentBefore !== '0') throw new Error(`expected initial DMS sent 0, got: ${metricDmsSentBefore}`);

  const form = window.document.querySelector('#leadForm');
  window.document.querySelector('#leadHandle').value = '@testlead';
  window.document.querySelector('#leadStage').value = 'responded';
  window.document.querySelector('#leadSource').value = 'instagram_outbound';
  window.document.querySelector('#leadAmount').value = '1500';
  window.document.querySelector('#leadObjection').value = 'price';
  window.document.querySelector('#leadNotes').value = 'smoke test lead';

  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 20));

  const metricDmsSentAfter = window.document.querySelector('#metricDmsSent')?.textContent?.trim();
  const savedLeads = JSON.parse(window.localStorage.getItem('beluv-sales-dashboard-v1') || '[]');

  if (metricDmsSentAfter !== '1') throw new Error(`expected DMS sent 1 after submit, got: ${metricDmsSentAfter}`);
  if (!savedLeads.length || savedLeads[0].handle !== '@testlead') {
    throw new Error('expected submitted lead to persist in localStorage');
  }

  console.log('smoke test passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
