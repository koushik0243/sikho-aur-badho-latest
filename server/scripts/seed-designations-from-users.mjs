// Fills the designations table (SuperAdmin → Manage Designation) with every
// designation learners already have, so the new Designation dropdowns offer
// them and editing a learner never loses their designation. Names that are
// already in the table (case-insensitive) are skipped; safe to run again.
//
//   node scripts/seed-designations-from-users.mjs          # dry run — shows changes
//   node scripts/seed-designations-from-users.mjs --apply  # writes them
import 'dotenv/config';
import mongoose from 'mongoose';
import slugify from 'slugify';

const apply = process.argv.includes('--apply');
const uri = process.env.MONGO_DB_URI || process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) { console.error('No MongoDB URI in .env'); process.exit(1); }

await mongoose.connect(uri);
const db = mongoose.connection.db;
console.log(`Database: ${mongoose.connection.host}/${mongoose.connection.name}  (${apply ? 'APPLY' : 'dry run'})`);

const used = await db.collection('users').aggregate([
  { $match: { designation: { $type: 'string', $nin: [''] } } },
  { $group: { _id: { $trim: { input: '$designation' } }, learners: { $sum: 1 } } },
  { $match: { _id: { $ne: '' } } },
  { $sort: { _id: 1 } },
]).toArray();

const table = db.collection('designations');
const existing = await table.find({ deletedAt: null }).project({ name: 1, slug: 1 }).toArray();
const haveName = new Set(existing.map(d => d.name.toLowerCase()));
const haveSlug = new Set((await table.find({}).project({ slug: 1 }).toArray()).map(d => d.slug));

const toInsert = [];
for (const { _id: name, learners } of used) {
  if (haveName.has(name.toLowerCase())) { console.log(`  skip    ${name} (already listed)`); continue; }
  haveName.add(name.toLowerCase());
  const base = slugify(name, { lower: true, strict: true, trim: true }) || 'designation';
  let slug = base;
  for (let i = 1; haveSlug.has(slug); i++) slug = `${base}-${i}`;
  haveSlug.add(slug);
  const now = new Date();
  toInsert.push({ name, slug, description: '', status: 'active', deletedAt: null, createdAt: now, updatedAt: now, __v: 0 });
  console.log(`  add     ${name}  (used by ${learners} learner${learners === 1 ? '' : 's'})`);
}

if (!toInsert.length) console.log('Nothing to add.');
else if (apply) console.log(`Inserted ${(await table.insertMany(toInsert)).insertedCount} designation(s).`);
else console.log(`${toInsert.length} designation(s) would be added — run with --apply to write them.`);

await mongoose.disconnect();
