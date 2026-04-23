(function () {
  const config = window.BELUV_CONFIG || {};
  const supabaseUrl = config.supabaseUrl || '';
  const supabaseAnonKey = config.supabaseAnonKey || '';
  const canUseSupabase = Boolean(supabaseUrl && supabaseAnonKey && window.supabase?.createClient);

  const client = canUseSupabase
    ? window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;

  function rowToLead(row) {
    return {
      id: row.id,
      handle: row.handle,
      stage: row.stage,
      source: row.source,
      amount: Number(row.amount) || 0,
      objection: row.objection || '',
      notes: row.notes || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function leadToRow(userId, lead) {
    return {
      id: lead.id,
      user_id: userId,
      handle: lead.handle,
      stage: lead.stage,
      source: lead.source,
      amount: Number(lead.amount) || 0,
      objection: lead.objection || '',
      notes: lead.notes || '',
      created_at: lead.createdAt,
      updated_at: lead.updatedAt,
    };
  }

  const api = {
    isConfigured() {
      return canUseSupabase;
    },

    getClient() {
      return client;
    },

    async getSession() {
      if (!client) return { session: null, error: null };
      const { data, error } = await client.auth.getSession();
      return { session: data.session, error };
    },

    onAuthStateChange(callback) {
      if (!client) return () => {};
      const { data } = client.auth.onAuthStateChange((_event, session) => callback(session));
      return () => data.subscription.unsubscribe();
    },

    async signIn(email, password) {
      if (!client) throw new Error('Supabase is not configured yet.');
      return client.auth.signInWithPassword({ email, password });
    },

    async signUp(email, password) {
      if (!client) throw new Error('Supabase is not configured yet.');
      return client.auth.signUp({ email, password });
    },

    async signOut() {
      if (!client) return { error: null };
      return client.auth.signOut();
    },

    async listLeads(userId) {
      if (!client || !userId) return [];
      const { data, error } = await client
        .from('leads')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(rowToLead);
    },

    async upsertLead(userId, lead) {
      if (!client || !userId) return lead;
      const row = leadToRow(userId, lead);
      const { error } = await client.from('leads').upsert(row, { onConflict: 'id' });
      if (error) throw error;
      return lead;
    },

    async replaceAllLeads(userId, leads) {
      if (!client || !userId) return leads;
      const { error: deleteError } = await client.from('leads').delete().eq('user_id', userId);
      if (deleteError) throw deleteError;
      if (!leads.length) return [];
      const rows = leads.map((lead) => leadToRow(userId, lead));
      const { error: insertError } = await client.from('leads').insert(rows);
      if (insertError) throw insertError;
      return leads;
    },

    async deleteLead(userId, leadId) {
      if (!client || !userId) return;
      const { error } = await client.from('leads').delete().eq('user_id', userId).eq('id', leadId);
      if (error) throw error;
    },

    async clearLeads(userId) {
      if (!client || !userId) return;
      const { error } = await client.from('leads').delete().eq('user_id', userId);
      if (error) throw error;
    },
  };

  window.BeluvCloudStore = api;
})();
