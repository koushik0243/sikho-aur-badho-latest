// Adds the standard positions of a retail store and its organization (head
// office) to the designations table (SuperAdmin → Manage Designation).
// Names already in the table (case-insensitive) are skipped, so existing
// designations and anything added by hand are left alone; safe to run again.
//
//   node scripts/seed-standard-designations.mjs          # dry run — shows changes
//   node scripts/seed-standard-designations.mjs --apply  # writes them
import 'dotenv/config';
import mongoose from 'mongoose';
import slugify from 'slugify';

// [name, description] — grouped from the top of the organization down to the store floor.
const DESIGNATIONS = [
  // Leadership
  ['Director', 'Organization leadership — sets the overall direction of the business.'],
  ['General Manager', 'Organization leadership — runs day-to-day business across all departments and stores.'],
  ['Regional Manager', 'Organization leadership — responsible for all stores in a region.'],
  ['Area Manager', 'Organization leadership — responsible for a cluster of stores in an area.'],

  // Department heads (head office)
  ['Accounts Manager', 'Accounts department head — books, billing and statutory records.'],
  ['Finance Manager', 'Finance department head — budgets, cash flow and financial planning.'],
  ['HR Manager', 'HR department head — hiring, people policies and employee relations.'],
  ['Marketing Manager', 'Marketing department head — brand, campaigns and promotions.'],
  ['Operations Manager', 'Operations department head — supply, logistics and store operations.'],
  ['Sales Manager', 'Sales department head — sales targets and sales teams.'],
  ['Design Manager', 'Design department head — product and collection design.'],
  ['IT Manager', 'Engineering department head — systems, software and IT support.'],
  ['Training Manager', 'Head of learning and development — staff training programmes.'],

  // Head-office staff
  ['Accountant', 'Accounts — maintains accounts, invoices and reconciliations.'],
  ['Accounts Executive', 'Accounts — day-to-day billing and payment entries.'],
  ['Finance Executive', 'Finance — reports, budgets and payment follow-ups.'],
  ['HR Executive', 'HR — onboarding, attendance and employee records.'],
  ['Recruiter', 'HR — sourcing and hiring staff for stores and office.'],
  ['Marketing Executive', 'Marketing — runs campaigns and in-store promotions.'],
  ['Digital Marketing Executive', 'Marketing — social media, online ads and the website.'],
  ['Operations Executive', 'Operations — coordinates stock movement and store operations.'],
  ['Sales Executive', 'Sales — handles accounts and drives sales.'],
  ['Business Development Executive', 'Sales — finds new customers, partners and markets.'],
  ['Designer', 'Design — creates product and collection designs.'],
  ['Software Engineer', 'Engineering — builds and maintains the company software.'],
  ['IT Support Executive', 'Engineering — supports systems, devices and the store network.'],
  ['Trainer', 'Learning and development — delivers training to store and office staff.'],

  // Store management
  ['Store Manager', 'Store — runs the store: sales, staff, stock and customer experience.'],
  ['Assistant Store Manager', 'Store — supports the store manager and runs the store in their absence.'],
  ['Floor Manager', 'Store — manages the shop floor and the teams on it.'],
  ['Floor Supervisor', 'Store — supervises sales staff and service on a floor or section.'],
  ['Shift Supervisor', 'Store — leads the team on a shift and opens or closes the store.'],
  ['Team Leader', 'Store — leads a small team of sales associates.'],

  // Store staff
  ['Senior Sales Associate', 'Store — experienced sales staff who also guides new associates.'],
  ['Sales Associate', 'Store — helps customers choose products and completes sales.'],
  ['Fashion Consultant', 'Store — styling advice and personalised product recommendations.'],
  ['Customer Service Executive', 'Store — handles queries, exchanges, returns and complaints.'],
  ['Cashier', 'Store — billing and payments at the counter.'],
  ['Visual Merchandiser', 'Store — window displays, product layout and in-store presentation.'],
  ['Inventory Executive', 'Store — stock counts, receiving and inventory records.'],
  ['Store Keeper', 'Store — manages the stockroom and issues stock to the floor.'],
  ['Alteration Tailor', 'Store — garment alterations and fittings for customers.'],
  ['Delivery Executive', 'Store — delivers orders to customers.'],
  ['Security Guard', 'Store — store security and loss prevention.'],
  ['Housekeeping Staff', 'Store — keeps the store clean and presentable.'],

  // Entry level
  ['Trainee', 'Entry level — new staff member in training.'],
  ['Intern', 'Entry level — short-term internship.'],
];

const apply = process.argv.includes('--apply');
const uri = process.env.MONGO_DB_URI || process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) { console.error('No MongoDB URI in .env'); process.exit(1); }

await mongoose.connect(uri);
const db = mongoose.connection.db;
console.log(`Database: ${mongoose.connection.host}/${mongoose.connection.name}  (${apply ? 'APPLY' : 'dry run'})`);

const table = db.collection('designations');
const haveName = new Set((await table.find({ deletedAt: null }).project({ name: 1 }).toArray()).map(d => d.name.toLowerCase()));
const haveSlug = new Set((await table.find({}).project({ slug: 1 }).toArray()).map(d => d.slug));

const toInsert = [];
for (const [name, description] of DESIGNATIONS) {
  if (haveName.has(name.toLowerCase())) { console.log(`  skip    ${name} (already listed)`); continue; }
  haveName.add(name.toLowerCase());
  const base = slugify(name, { lower: true, strict: true, trim: true }) || 'designation';
  let slug = base;
  for (let i = 1; haveSlug.has(slug); i++) slug = `${base}-${i}`;
  haveSlug.add(slug);
  const now = new Date();
  toInsert.push({ name, slug, description, status: 'active', deletedAt: null, createdAt: now, updatedAt: now, __v: 0 });
  console.log(`  add     ${name}`);
}

if (!toInsert.length) console.log('Nothing to add.');
else if (apply) console.log(`Inserted ${(await table.insertMany(toInsert)).insertedCount} designation(s).`);
else console.log(`${toInsert.length} designation(s) would be added — run with --apply to write them.`);

await mongoose.disconnect();
