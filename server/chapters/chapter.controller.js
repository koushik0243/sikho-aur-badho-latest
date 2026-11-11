import express from 'express';
import * as ChapterHelper from './chapter.service.js';
import { requireSuperAdmin } from '../middleware/authMiddleware.js';

const Router = express.Router();

const createChapter = async (req, res, next) => {
    try {
        const data = await ChapterHelper.createChapter(req.body);
        res.status(200).json({ status: 200, message: "Successfully added.", data });
    } catch (error) {
        next(error);
    }
};

const editChapter = async (req, res, next) => {
    try {
        const data = await ChapterHelper.editChapter(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const updateChapter = async (req, res, next) => {
    try {
        const data = await ChapterHelper.updateChapter(req.params.id, req.body);
        res.status(200).json({ status: 200, message: "Successfully updated.", data });
    } catch (error) {
        next(error);
    }
};

const listChapter = async (req, res, next) => {
    try {
        const { status, courseId } = req.query;
        const data = await ChapterHelper.listChapter({ status, courseId });
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const listChapterPagination = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { status, courseId } = req.query;

        const [chapters, total] = await Promise.all([
            ChapterHelper.listChapterPagination(page, limit, { status, courseId }),
            ChapterHelper.getChapterCount({ status, courseId })
        ]);
        res.status(200).json({
            status: 200,
            message: "Successfully fetched.",
            data: chapters,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        next(error);
    }
};

const deleteChapter = async (req, res, next) => {
    try {
        const data = await ChapterHelper.deleteChapter(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully deleted.", data });
    } catch (error) {
        next(error);
    }
};

const checkChapterTitle = async (req, res, next) => {
    try {
        const { title, courseId, excludeId } = req.query;
        if (!title || !courseId) {
            return res.status(400).json({ status: 400, message: "title and courseId are required." });
        }
        const data = await ChapterHelper.checkChapterTitle(title, courseId, excludeId || null);
        res.status(200).json({ status: 200, message: "Successfully checked.", data });
    } catch (error) {
        next(error);
    }
};

Router.post('/create', createChapter);
Router.get('/list', listChapter);
Router.get('/list-pagination', listChapterPagination);
Router.get('/check', checkChapterTitle);
Router.get('/edit/:id', editChapter);
Router.put('/update/:id', updateChapter);
Router.get('/delete/:id', requireSuperAdmin, deleteChapter);
Router.get('/:id', editChapter);

export default Router;
