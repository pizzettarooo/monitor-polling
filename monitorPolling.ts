import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
const STELLAR_API_URL = 'https://api.stellar.expert/explorer/testnet/account/';
const SITE_WALLET = 'GCMEELHBN6VBVFGVRRD7PAGJZY63F3PWA4CL6QGXCYNMFPFL6J77B2RV';

let lastTimestamp: number = Date.now();

async function checkNewTransactions() {
  try {
    const res = await fetch(`${STELLAR_API_URL}${SITE_WALLET}/payments?limit=50&order=desc`);
    const data = await res.json();

    const newTxs = data._embedded.records.filter((tx: any) =>
      tx.to === SITE_WALLET && new Date(tx.created_at).getTime() > lastTimestamp
    );

    if (newTxs.length) {
      console.log(`📥 Trovate ${newTxs.length} nuove transazioni.`);

      for (const tx of newTxs) {
        const sender = tx.from;
        const amount = parseFloat(tx.amount);

        const { data: user } = await supabase.from('users').select('id, credits').eq('wallet', sender).single();
        if (!user) {
          console.warn(`⚠️ Nessun utente registrato con wallet ${sender}`);
          continue;
        }

        await supabase
          .from('users')
          .update({ credits: user.credits + Math.floor(amount) })
          .eq('id', user.id);

        await supabase.from('transactions').insert({
          id: tx.id,
          user_id: user.id,
          amount,
          type: 'deposit'
        });

        console.log(`✅ Aggiornati i crediti per ${sender}: +${Math.floor(amount)} Pi`);
      }

      const latest = new Date(newTxs[0].created_at).getTime();
      lastTimestamp = latest;
    } else {
      console.log('🔍 Nessuna nuova transazione trovata.');
    }
  } catch (err) {
    console.error('❌ Errore durante il polling:', err);
  }
}

setInterval(checkNewTransactions, 60 * 1000);