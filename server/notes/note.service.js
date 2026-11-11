import Note from './note.model.js';

export const createNote = async ({ userId, courseId, chapterId, topicId, text }) => {
  const note = new Note({ userId, courseId, chapterId: chapterId || null, topicId: topicId || null, text });
  return await note.save();
};

export const listNotes = async ({ userId, courseId, chapterId, topicId }) => {
  const query = { userId, courseId };
  if (chapterId) query.chapterId = chapterId;
  if (topicId)   query.topicId   = topicId;
  return await Note.find(query).sort({ createdAt: -1 }).lean();
};

export const deleteNote = async (id, userId) => {
  return await Note.findOneAndDelete({ _id: id, userId }).lean();
};
