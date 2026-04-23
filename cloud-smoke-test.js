const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const appDir = __dirname;
const indexHtml = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(appDir, 'app.js'), 'utf8');

async function run() {
  const calls = [];
  const fakeSession = { user: { id: 'user-123', email: 'berto@test.com' } };
  const cloudLeads = [];

  const dom = new JSDOM(indexHtml, {
    url: 'http://127.0.0.1:8033',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.alert = () => {};
      window.confirm = () => true;
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.localStorage.setItem('beluv-sales-dashboard-v1', JSON.stringify([
        {
          id: 'lead-1',
          handle: '@migrated',
          stage: 'responded',
          source: 'instagram_outbound',
          amount: 200,
          objection: 'price',
          notes: 'local lead',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]));
      window.BeluvCloudStore = {
        isConfigured: () => true,
        getSession: async () => ({ session: fakeSession, error: null }),
        onAuthStateChange: () => () => {},
        signIn: async () => ({ error: null }),
        signUp: async () => ({ error: null, data: { session: fakeSession } }),
        signOut: async () => ({ error: null }),
        listLeads: async () => cloudLeads,
        replaceAllLeads: async (userId, leads) => {
          calls.push({ type: 'replaceAllLeads', userId, leads });
          return leads;
        },
      };
    },
  });

  const { window } = dom;
  window.eval(appJs);

  await new Promise((resolve) => setTimeout(resolve, 50));

  const syncMode = window.document.querySelector('#syncModePill')?.textContent?.trim();
  const syncStatus = window.document.querySelector('#syncStatus')?.textContent?.trim();
  const authMessage = window.document.querySelector('#authMessage')?.textContent?.trim();
  const dmsSent = window.document.querySelector('#metricDmsSent')?.textContent?.trim();

  if (syncMode !== 'cloud sync') throw new Error(`expected cloud sync mode, got: ${syncMode}`);
  if (!syncStatus.includes('migrated') && !syncStatus.includes('synced')) throw new Error(`unexpected sync status: ${syncStatus}`);
  if (!authMessage.includes('cloud sync is live')) throw new Error(`unexpected auth message: ${authMessage}`);
  if (dmsSent !== '1') throw new Error(`expected migrated cloud lead count 1, got: ${dmsSent}`);

  const migrationCall = calls.find((call) => call.type === 'replaceAllLeads');
  if (!migrationCall) throw new Error('expected replaceAllLeads to be called for local-to-cloud migration');
  if (migrationCall.userId !== 'user-123') throw new Error(`expected user-123, got ${migrationCall.userId}`);
  if (!migrationCall.leads.length || migrationCall.leads[0].handle !== '@migrated') {
    throw new Error('expected migrated lead payload');
  }

  console.log('cloud smoke test passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
