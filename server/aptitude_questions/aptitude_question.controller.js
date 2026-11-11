import express from 'express';
import mongoose from 'mongoose';
import * as AptitudeQuestionHelper from './aptitude_question.service.js';
import { requireSuperAdmin } from '../middleware/authMiddleware.js';

const Router = express.Router();
const MAX_BULK_DELETE = 1000; // one course's Generated QA never comes close

// POST /permanent-bulk { ids: [...] } — Generated QA: delete the ticked questions for good.
const permanentDeleteAptitudeQuestions = async (req, res, next) => {
    try {
        const ids = req.body?.ids;
        if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_BULK_DELETE) {
            return res.status(400).json({ status: 400, message: `Choose between 1 and ${MAX_BULK_DELETE} questions to delete.` });
        }
        if (!ids.every(id => mongoose.isValidObjectId(id))) {
            return res.status(400).json({ status: 400, message: "Invalid question id." });
        }
        const data = await AptitudeQuestionHelper.permanentDeleteQuestions(ids);
        res.status(200).json({ status: 200, message: `${data.deletedCount} question(s) permanently deleted.`, data });
    } catch (error) {
        next(error);
    }
};

const generateQuestions = async (req, res, next) => {
    try {
        const { courseId, courseTitle, courseDesc, context } = req.body;
        // Context is optional once the course is saved: the lesson video transcripts are
        // used too. An unsaved course has no lessons, so it still needs context.
        const hasContext = typeof context === 'string' && context.trim() !== '';
        if (!hasContext && !(courseId && mongoose.Types.ObjectId.isValid(courseId))) {
            return res.status(400).json({ status: 400, message: "context is required." });
        }
        const data = await AptitudeQuestionHelper.generateAndSaveQuestions({
            courseId: courseId || null,
            courseTitle: courseTitle || 'Course',
            courseDesc: courseDesc || '',
            context: hasContext ? context : '',
        });
        res.status(200).json({ status: 200, message: `${data.length} questions generated.`, data });
    } catch (error) {
        next(error);
    }
};

const listAptitudeQuestions = async (req, res, next) => {
    try {
        const { courseId, difficulty, status } = req.query;
        if (!courseId) {
            return res.status(400).json({ status: 400, message: "courseId is required." });
        }
        const data = await AptitudeQuestionHelper.listQuestions({ courseId, difficulty, status });
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const attachCourse = async (req, res, next) => {
    try {
        const { ids, courseId } = req.body;
        if (!Array.isArray(ids) || !ids.length || !courseId) {
            return res.status(400).json({ status: 400, message: "ids (array) and courseId are required." });
        }
        const data = await AptitudeQuestionHelper.attachCourseId(ids, courseId);
        res.status(200).json({ status: 200, message: "Successfully attached.", data });
    } catch (error) {
        next(error);
    }
};

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

const createAptitudeQuestion = async (req, res, next) => {
    try {
        const { courseId, question, answer, difficulty } = req.body;
        if (!question || !String(question).trim() || !difficulty) {
            return res.status(400).json({ status: 400, message: "question and difficulty are required." });
        }
        if (!DIFFICULTIES.includes(difficulty)) {
            return res.status(400).json({ status: 400, message: "Invalid difficulty." });
        }
        const data = await AptitudeQuestionHelper.createQuestion({
            courseId: courseId || null,
            question: String(question).trim(),
            answer: answer ? String(answer).trim() : '',
            difficulty,
        });
        res.status(200).json({ status: 200, message: "Successfully added.", data });
    } catch (error) {
        next(error);
    }
};

const updateAptitudeQuestion = async (req, res, next) => {
    try {
        const data = await AptitudeQuestionHelper.updateQuestion(req.params.id, req.body);
        if (!data) return res.status(404).json({ status: 404, message: "Question not found." });
        res.status(200).json({ status: 200, message: "Successfully updated.", data });
    } catch (error) {
        next(error);
    }
};

const permanentDeleteAptitudeQuestion = async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ status: 400, message: "Invalid question id." });
        }
        const data = await AptitudeQuestionHelper.permanentDeleteQuestion(req.params.id);
        if (!data) return res.status(404).json({ status: 404, message: "Question not found." });
        res.status(200).json({ status: 200, message: "Question permanently deleted.", data });
    } catch (error) {
        next(error);
    }
};

Router.post('/generate',       generateQuestions);
Router.post('/create',         createAptitudeQuestion);
Router.post('/permanent-bulk', requireSuperAdmin, permanentDeleteAptitudeQuestions);
Router.get('/list',            listAptitudeQuestions);
Router.put('/attach-course',   attachCourse);
Router.put('/update/:id',      updateAptitudeQuestion);
Router.delete('/permanent/:id', permanentDeleteAptitudeQuestion);

export default Router;
