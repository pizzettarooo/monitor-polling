import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'
import fetch from 'node-fetch'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const WALLET_ADDRESS = process.env.WALLET_ADDRESS!
const LAST_TIMESTAMP_KEY = 'last_transaction_ts'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function getTransactions() {
  const url = `https://api.mainnet.minepi.com/transactions?account=${WALLET_ADDRESS}&limit=10`
  const res = await fetch(url)
  const json = await res.json()
  return json._embedded.records
}

async function getLastTimestamp(): Promise<string | null> {
  const { data, error } = await supabase
    .from('system')
    .select('value')
    .eq('key', LAST_TIMESTAMP_KEY)
    .single()

  return error ? null : data?.value ?? null
}

async function setLastTimestamp(timestamp: string) {
  await supabase
    .from('system')
    .upsert({ key: LAST_TIMESTAMP_KEY, value: timestamp }, { onConflict: 'key' })
}

async function creditUser(wallet: string, amount: number) {
  const { data: user } = await supabase
    .from('users')
    .select('id, credits')
    .eq('wallet', wallet)
    .single()

  if (!user) return

  await supabase.from('transactions').insert({
    id: crypto.randomUUID(),
    user_id: user.id,
    amount,
    type: 'deposit'
  })

  await supabase
    .from('users')
    .update({ credits: user.credits + amount })
    .eq('id', user.id)
}

async function main() {
  const lastTS = await getLastTimestamp()
  const txs = await getTransactions()

  for (const tx of txs.reverse()) {
    if (lastTS && tx.created_at <= lastTS) continue
    const amount = parseFloat(tx.amount)
    const sender = tx.source_account
    console.log(`Nuova transazione da ${sender} (${amount} Pi)`)
    await creditUser(sender, Math.floor(amount))
    await setLastTimestamp(tx.created_at)
  }
}

main().catch(console.error)
