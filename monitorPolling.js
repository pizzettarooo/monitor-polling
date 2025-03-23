const { createClient } = require('@supabase/supabase-js');
const { Server } = require('stellar-sdk');

// Configurazioni
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
const server = new Server('https://api.testnet.minepi.com');

// Recupera ultimo timestamp dalle environment
let lastChecked = Date.now() - 1000 * 60 * 60;

async function checkTransactions() {
  console.log('🔄 Controllo nuove transazioni...');

  const payments = await server
    .payments()
    .forAccount(process.env.SITE_WALLET)
    .order('desc')
    .limit(10)
    .call();

  for (const record of payments.records) {
    const timestamp = new Date(record.created_at).getTime();

    if (timestamp <= lastChecked) continue;
    if (record.to !== process.env.SITE_WALLET) continue;
    if (record.asset_type !== 'native') continue;

    const sender = record.from;
    const amount = parseFloat(record.amount);

    const { data: user } = await supabase
      .from('users')
      .select('id, credits')
      .eq('wallet', sender)
      .single();

    if (user) {
      console.log(`✅ Nuova ricarica da ${sender} per ${amount} Pi`);
      await supabase
        .from('users')
        .update({ credits: user.credits + amount })
        .eq('id', user.id);

      await supabase.from('transactions').insert({
        id: record.id,
        user_id: user.id,
        amount,
        type: 'deposit'
      });
    }
  }

  lastChecked = Date.now();
}

setInterval(checkTransactions, 60 * 1000); // Ogni minuto
