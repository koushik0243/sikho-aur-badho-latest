import express from 'express';
import mongoose from 'mongoose';
import * as QuizQuestionHelper from './quiz_question.service.js';
import { requireSuperAdmin } from '../middleware/authMiddleware.js';

const Router = express.Router();
const MAX_BULK_DELETE = 1000; // one quiz's Generated QA never comes close

const generateQuestions = async (req, res, next) => {
    try {
        const { courseId, chapterId, quizId, courseTitle, chapterTitle } = req.body;
        if (!courseId || !chapterId || !quizId) {
            return res.status(400).json({ status: 400, message: "courseId, chapterId, and quizId are required." });
        }
        const data = await QuizQuestionHelper.generateAndSaveQuestions({
            courseId, chapterId, quizId,
            courseTitle: courseTitle || 'Course',
            chapterTitle: chapterTitle || 'Chapter',
        });
        res.status(200).json({ status: 200, message: `${data.length} questions generated.`, data });
    } catch (error) {
        next(error);
    }
};

const createQuizQuestion = async (req, res, next) => {
    try {
        const { courseId, chapterId, quizId, question, difficulty } = req.body;
        if (!courseId || !chapterId || !quizId || !question || !difficulty) {
            return res.status(400).json({ status: 400, message: "courseId, chapterId, quizId, question, and difficulty are required." });
        }
        const data = await QuizQuestionHelper.createQuestion(req.body);
        res.status(200).json({ status: 200, message: "Successfully added.", data });
    } catch (error) {
        next(error);
    }
};

const editQuizQuestion = async (req, res, next) => {
    try {
        const data = await QuizQuestionHelper.editQuestion(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const updateQuizQuestion = async (req, res, next) => {
    try {
        const data = await QuizQuestionHelper.updateQuestion(req.params.id, req.body);
        res.status(200).json({ status: 200, message: "Successfully updated.", data });
    } catch (error) {
        next(error);
    }
};

const listQuizQuestions = async (req, res, next) => {
    try {
        const { quizId, courseId, chapterId, difficulty, status, forLearner } = req.query;
        if (!quizId) {
            return res.status(400).json({ status: 400, message: "quizId is required." });
        }
        // Only the learner quiz-taking UI opts into aptitude-level-based selection
        // (via forLearner=true). Admin/store-owner question-management views keep
        // seeing the full, unfiltered list they already rely on.
        if (forLearner === 'true') {
            const data = await QuizQuestionHelper.listQuestionsForLearner({ quizId, userId: req.user?._id });
            return res.status(200).json({ status: 200, message: "Successfully fetched.", data });
        }
        const data = await QuizQuestionHelper.listQuestions({ quizId, courseId, chapterId, difficulty, status });
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const listQuizQuestionsPagination = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { quizId, courseId, chapterId, difficulty, status } = req.query;
        const filters = { quizId, courseId, chapterId, difficulty, status };

        const [questions, total] = await Promise.all([
            QuizQuestionHelper.listQuestionsPagination(page, limit, filters),
            QuizQuestionHelper.getQuestionCount(filters),
        ]);
        res.status(200).json({
            status: 200,
            message: "Successfully fetched.",
            data: questions,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        next(error);
    }
};

const deleteQuizQuestion = async (req, res, next) => {
    try {
        const data = await QuizQuestionHelper.deleteQuestion(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully deleted.", data });
    } catch (error) {
        next(error);
    }
};

const permanentDeleteQuizQuestion = async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ status: 400, message: "Invalid question id." });
        }
        const data = await QuizQuestionHelper.permanentDeleteQuestion(req.params.id);
        if (!data) return res.status(404).json({ status: 404, message: "Question not found." });
        res.status(200).json({ status: 200, message: "Question permanently deleted.", data });
    } catch (error) {
        next(error);
    }
};

// POST /permanent-bulk { ids: [...] } — Generated QA: delete the ticked questions for good.
const permanentDeleteQuizQuestions = async (req, res, next) => {
    try {
        const ids = req.body?.ids;
        if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_BULK_DELETE) {
            return res.status(400).json({ status: 400, message: `Choose between 1 and ${MAX_BULK_DELETE} questions to delete.` });
        }
        if (!ids.every(id => mongoose.isValidObjectId(id))) {
            return res.status(400).json({ status: 400, message: "Invalid question id." });
        }
        const data = await QuizQuestionHelper.permanentDeleteQuestions(ids);
        res.status(200).json({ status: 200, message: `${data.deletedCount} question(s) permanently deleted.`, data });
    } catch (error) {
        next(error);
    }
};

Router.post('/generate',        generateQuestions);
Router.post('/create',          createQuizQuestion);
Router.post('/permanent-bulk',  requireSuperAdmin, permanentDeleteQuizQuestions);
Router.get('/list',             listQuizQuestions);
Router.get('/list-pagination',  listQuizQuestionsPagination);
Router.get('/edit/:id',         editQuizQuestion);
Router.put('/update/:id',       updateQuizQuestion);
Router.get('/delete/:id',       deleteQuizQuestion);
Router.delete('/permanent/:id', permanentDeleteQuizQuestion);
Router.get('/:id',              editQuizQuestion);

export default Router;
