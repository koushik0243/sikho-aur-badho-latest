import express from 'express';
import * as TagService from './tag.service.js';

const Router = express.Router();

const createTag = async (req, res, next) => {
    try {
        const userId = req.user?._id || null;
        const data = await TagService.createTag(req.body, userId);
        res.status(200).json({ status: 200, message: "Successfully added.", data });
    } catch (error) {
        next(error);
    }
};

const getTag = async (req, res, next) => {
    try {
        const data = await TagService.getTag(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const updateTag = async (req, res, next) => {
    try {
        const data = await TagService.updateTag(req.params.id, req.body);
        res.status(200).json({ status: 200, message: "Successfully updated.", data });
    } catch (error) {
        next(error);
    }
};

const listTags = async (req, res, next) => {
    try {
        const { status } = req.query;
        const data = await TagService.listTags({ status });
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const listTagsPagination = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { status } = req.query;
        const [data, total] = await Promise.all([
            TagService.listTagsPagination(page, limit, { status }),
            TagService.getTagCount({ status })
        ]);
        res.status(200).json({
            status: 200,
            message: "Successfully fetched.",
            data,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        next(error);
    }
};

const deleteTag = async (req, res, next) => {
    try {
        const data = await TagService.deleteTag(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully deleted.", data });
    } catch (error) {
        next(error);
    }
};

Router.post('/create', createTag);
Router.get('/list', listTags);
Router.get('/list-pagination', listTagsPagination);
Router.get('/details/:id', getTag);
Router.put('/update/:id', updateTag);
Router.get('/delete/:id', deleteTag);

export default Router;
