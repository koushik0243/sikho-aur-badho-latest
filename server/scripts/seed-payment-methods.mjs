// Adds the standard payment methods to the payment_methods table (SuperAdmin →
// Payments → Manage Payment Method). Each keeps the exact slug that invoices
// already store (e.g. 'netbanking', 'manual'), so existing invoices show the
// right name. Methods already in the table (same slug, or same name ignoring
// case) are skipped; safe to run again.
//
//   node scripts/seed-payment-methods.mjs          # dry run — shows changes
//   node scripts/seed-payment-methods.mjs --apply  # writes them
import 'dotenv/config';
import mongoose from 'mongoose';

// [slug, name, description]
const METHODS = [
  ['card',          'Card',          'Credit or debit card.'],
  ['upi',           'UPI',           'UPI apps such as Google Pay, PhonePe or Paytm.'],
  ['wallet',        'Wallet',        'Mobile wallets.'],
  ['netbanking',    'Net Banking',   'Internet banking.'],
  ['cash',          'Cash',          'Cash payment.'],
  ['bank_transfer', 'Bank Transfer', 'NEFT, RTGS or IMPS transfer.'],
  ['cheque',        'Cheque',        'Payment by cheque.'],
  ['manual',        'Manual',        'Recorded manually — used when the super admin assigns credits.'],
];

const apply = process.argv.includes('--apply');
const uri = process.env.MONGO_DB_URI || process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) { console.error('No MongoDB URI in .env'); process.exit(1); }

await mongoose.connect(uri);
const db = mongoose.connection.db;
console.log(`Database: ${mongoose.connection.host}/${mongoose.connection.name}  (${apply ? 'APPLY' : 'dry run'})`);

const table = db.collection('payment_methods');
const rows = await table.find({}).project({ name: 1, slug: 1, deletedAt: 1 }).toArray();
const haveSlug = new Set(rows.map(r => r.slug));
const haveName = new Set(rows.filter(r => !r.deletedAt).map(r => r.name.toLowerCase()));

const toInsert = [];
for (const [slug, name, description] of METHODS) {
  if (haveSlug.has(slug) || haveName.has(name.toLowerCase())) { console.log(`  skip    ${name} (already listed)`); continue; }
  const now = new Date();
  toInsert.push({ name, slug, description, status: 'active', deletedAt: null, createdAt: now, updatedAt: now, __v: 0 });
  console.log(`  add     ${name}  (${slug})`);
}

if (!toInsert.length) console.log('Nothing to add.');
else if (apply) console.log(`Inserted ${(await table.insertMany(toInsert)).insertedCount} payment method(s).`);
else console.log(`${toInsert.length} payment method(s) would be added — run with --apply to write them.`);

// Invoices whose payment method isn't in the table (they would show their raw code).
const known = new Set([...haveSlug, ...toInsert.map(m => m.slug)]);
const used = await db.collection('invoices').distinct('payment_method', { payment_method: { $nin: [null, ''] } });
const unknown = used.filter(v => !known.has(String(v).toLowerCase()));
if (unknown.length) console.log(`Note: invoices use payment methods not in the table: ${unknown.join(', ')}`);

await mongoose.disconnect();
