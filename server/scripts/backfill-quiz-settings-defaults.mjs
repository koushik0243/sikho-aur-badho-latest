// Brings existing quizzes onto the current Settings-tab defaults.
//
// A setting is updated only when it's missing or still holds the OLD builder
// default (i.e. nobody changed it); any value an admin chose is kept.
// Selected questions are never touched.
//
//   node scripts/backfill-quiz-settings-defaults.mjs          # dry run — shows changes
//   node scripts/backfill-quiz-settings-defaults.mjs --apply  # writes them
import 'dotenv/config';
import mongoose from 'mongoose';
import Topic from '../topics/topic.model.js';

const NEW_DEFAULTS = {
  timeLimit: '60', timeUnit: 'Minutes', hideQuizTime: false,
  attemptsAllowed: '20', passingGrade: '20', maxQuestions: '20',
  quizAutoStart: false, questionLayout: 'single', questionOrder: 'sequential',
  hideQuestionNumber: false,
};
// What the builder used to pre-fill — a value equal to this was never changed.
const OLD_DEFAULTS = {
  timeLimit: '0', attemptsAllowed: '10', passingGrade: '80', maxQuestions: '10',
  questionOrder: 'random',
};

const apply = process.argv.includes('--apply');
const uri = process.env.MONGO_DB_URI || process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) { console.error('No MongoDB URI in .env'); process.exit(1); }

const isUnset = v => v === undefined || v === null || v === '';

await mongoose.connect(uri);
console.log(`Database: ${mongoose.connection.host}/${mongoose.connection.name}  (${apply ? 'APPLY' : 'dry run'})\n`);

const quizzes = await Topic.find({ video_type: 'quiz', deletedAt: null }).select('title courseId quizSettings').lean();
let changedCount = 0;
for (const t of quizzes) {
  const current = t.quizSettings && typeof t.quizSettings === 'object' ? t.quizSettings : {};
  const changes = {};
  for (const [key, def] of Object.entries(NEW_DEFAULTS)) {
    const v = current[key];
    const untouched = isUnset(v) || (key in OLD_DEFAULTS && String(v) === OLD_DEFAULTS[key]);
    if (untouched && String(v) !== String(def)) changes[key] = def;
  }
  const keys = Object.keys(changes);
  if (keys.length === 0) continue;
  changedCount++;
  console.log(`• ${t.title} (course ${t.courseId}): ${keys.map(k => `${k} ${JSON.stringify(current[k])} → ${JSON.stringify(changes[k])}`).join(', ')}`);
  if (apply) {
    await Topic.updateOne({ _id: t._id }, { $set: { quizSettings: { ...current, ...changes } } });
  }
}
console.log(`\n${quizzes.length} quiz(zes) checked, ${changedCount} ${apply ? 'updated' : 'would be updated'}.`);
await mongoose.disconnect();
