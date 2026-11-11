// Moves existing quiz + aptitude questions from the old status values
// ('active' / 'inactive') to the QA origin values ('generated' / 'created').
//
// There's no stored record of who made an existing question, so origin is
// inferred from how it was saved: AI generation inserts a whole batch at once
// (same quiz/course, same batchNumber, same moment), while a super admin's
// hand-written question is saved on its own. A question saved alone →
// 'created'; one saved as part of a batch → 'generated'.
// An old 'inactive' question that wasn't soft-deleted was hidden from every
// list, so it gets deletedAt to stay hidden.
//
//   node scripts/backfill-qa-status.mjs          # dry run — shows changes
//   node scripts/backfill-qa-status.mjs --apply  # writes them
import 'dotenv/config';
import mongoose from 'mongoose';

const apply = process.argv.includes('--apply');
const uri = process.env.MONGO_DB_URI || process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) { console.error('No MongoDB URI in .env'); process.exit(1); }

const SAME_MOMENT_MS = 2000;
const TABLES = [
  { name: 'quiz_questions',     parent: 'quizId' },
  { name: 'aptitude_questions', parent: 'courseId' },
];

await mongoose.connect(uri);
const db = mongoose.connection.db;
console.log(`Database: ${mongoose.connection.host}/${mongoose.connection.name}  (${apply ? 'APPLY' : 'dry run'})`);

for (const { name, parent } of TABLES) {
  const col = db.collection(name);
  const docs = await col.find({}).project({ [parent]: 1, batchNumber: 1, createdAt: 1, status: 1, deletedAt: 1, question: 1 }).toArray();

  // Saved-together groups: same parent, same batch, same moment.
  const groupSize = new Map();
  const keyOf = d => `${d[parent]}|${d.batchNumber}|${Math.floor(new Date(d.createdAt).getTime() / SAME_MOMENT_MS)}`;
  for (const d of docs) groupSize.set(keyOf(d), (groupSize.get(keyOf(d)) || 0) + 1);

  const ops = [];
  const counts = { generated: 0, created: 0, hidden: 0, unchanged: 0 };
  const createdTitles = [];
  for (const d of docs) {
    if (d.status === 'generated' || d.status === 'created') { counts.unchanged++; continue; }
    const origin = groupSize.get(keyOf(d)) === 1 ? 'created' : 'generated';
    const $set = { status: origin };
    if (d.status === 'inactive' && !d.deletedAt) { $set.deletedAt = new Date(); counts.hidden++; }
    counts[origin]++;
    if (origin === 'created' && !d.deletedAt) createdTitles.push(String(d.question).slice(0, 70));
    ops.push({ updateOne: { filter: { _id: d._id }, update: { $set } } });
  }

  console.log(`\n${name}: ${docs.length} question(s) — generated ${counts.generated}, created ${counts.created}, `
    + `inactive→hidden ${counts.hidden}, already migrated ${counts.unchanged}`);
  for (const t of createdTitles) console.log(`   created: ${t}`);
  if (apply && ops.length) {
    const r = await col.bulkWrite(ops);
    console.log(`   updated ${r.modifiedCount}`);
  }
}
await mongoose.disconnect();
