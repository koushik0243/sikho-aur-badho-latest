// Conversions run in memory (videoConvert.js), so a server restart drops any that were
// running or queued and their videos would stay "processing" forever. On startup, queue
// them again.
import mongoose from 'mongoose';
import Topic from '../topics/topic.model.js';
import Course from '../courses/course.model.js';
import { queueVideoConversion } from './videoConvert.js';
import { prepareTranscriptInBackgroundById } from '../topics/topic.transcript.js';
import TopicActivity from '../topic_activity/topic_activity.model.js';
import { queueSubmissionConversion } from '../topic_activity/topic_activity.controller.js';

async function resume() {
  const [lessons, courses, submissions] = await Promise.all([
    Topic.find({ videoStatus: 'processing', deletedAt: null }).select('videoUrl').lean(),
    Course.find({ introVideoStatus: 'processing', deletedAt: null }).select('intro_video').lean(),
    TopicActivity.find({ 'videos.status': 'processing' }).select('videos').lean(),
  ]);
  let submissionCount = 0;
  for (const r of submissions) {
    for (const v of r.videos || []) {
      if (v.status !== 'processing') continue;
      queueSubmissionConversion(r._id, v.file);
      submissionCount += 1;
    }
  }
  for (const t of lessons) {
    queueVideoConversion({
      model: Topic, id: t._id, field: 'videoUrl', statusField: 'videoStatus',
      url: t.videoUrl, onReady: prepareTranscriptInBackgroundById,
    });
  }
  for (const c of courses) {
    queueVideoConversion({ model: Course, id: c._id, field: 'intro_video', statusField: 'introVideoStatus', url: c.intro_video });
  }
  const total = lessons.length + courses.length + submissionCount;
  if (total) console.log(`[video] resumed ${total} video conversion(s)`);
}

/** Runs once the database connection is open. */
export function resumeVideoConversionsOnStartup() {
  const run = () => resume().catch(err => console.error(`[video] could not resume conversions: ${err.message}`));
  if (mongoose.connection.readyState === 1) run();
  else mongoose.connection.once('open', run);
}
