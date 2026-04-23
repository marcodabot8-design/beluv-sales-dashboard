const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const configPath = path.join(__dirname, 'config.js');
const configText = fs.readFileSync(configPath, 'utf8');
const urlMatch = configText.match(/supabaseUrl:\s*'([^']+)'/);
const keyMatch = configText.match(/supabaseAnonKey:\s*'([^']+)'/);
if (!urlMatch || !keyMatch) throw new Error('Supabase config missing');

const supabase = createClient(urlMatch[1], keyMatch[1]);
const email = 'beluv.prod@gmail.com';
const password = 'BeluvDashTemp!2026';

async function run() {
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  const user = signInData.user;
  if (!user) throw new Error('No user returned from sign-in');

  const leadId = `live-${Date.now()}`;
  const payload = {
    id: leadId,
    user_id: user.id,
    handle: '@phone-test',
    stage: 'responded',
    source: 'instagram_outbound',
    amount: 250,
    objection: 'price',
    notes: 'live Supabase integration test',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabase.from('leads').upsert(payload, { onConflict: 'id' });
  if (upsertError) throw upsertError;

  const { data: rows, error: selectError } = await supabase
    .from('leads')
    .select('id,handle,stage,source,amount,objection,notes')
    .eq('id', leadId)
    .limit(1);
  if (selectError) throw selectError;
  if (!rows || !rows.length) throw new Error('Inserted lead not found');

  const { error: deleteError } = await supabase.from('leads').delete().eq('id', leadId);
  if (deleteError) throw deleteError;

  console.log('live supabase test passed');
  console.log(JSON.stringify(rows[0]));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
