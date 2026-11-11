import express from 'express';
import * as NoteHelper from './note.service.js';

const Router = express.Router();

const createNote = async (req, res, next) => {
  try {
    const { courseId, chapterId, topicId, text } = req.body;
    if (!courseId || !text?.trim()) {
      return res.status(400).json({ status: 400, message: 'courseId and text are required.' });
    }
    const data = await NoteHelper.createNote({ userId: req.user._id, courseId, chapterId, topicId, text });
    res.status(201).json({ status: 201, message: 'Note saved.', data });
  } catch (error) {
    next(error);
  }
};

const listNotes = async (req, res, next) => {
  try {
    const { courseId, chapterId, topicId } = req.query;
    if (!courseId) {
      return res.status(400).json({ status: 400, message: 'courseId is required.' });
    }
    const data = await NoteHelper.listNotes({ userId: req.user._id, courseId, chapterId, topicId });
    res.status(200).json({ status: 200, message: 'Successfully fetched.', data });
  } catch (error) {
    next(error);
  }
};

const deleteNote = async (req, res, next) => {
  try {
    const deleted = await NoteHelper.deleteNote(req.params.id, req.user._id);
    if (!deleted) return res.status(404).json({ status: 404, message: 'Note not found.' });
    res.status(200).json({ status: 200, message: 'Note deleted.' });
  } catch (error) {
    next(error);
  }
};

Router.post('/create', createNote);
Router.get('/list',    listNotes);
Router.delete('/delete/:id', deleteNote);

export default Router;
