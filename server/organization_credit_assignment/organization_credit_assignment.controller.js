import express from 'express';
import * as OrgCreditAssignmentHelper from './organization_credit_assignment.service.js';

const Router = express.Router();

const createOrgCreditAssignment = async (req, res, next) => {
    try {
        const assignedBy = req.user?._id || null;
        const data = await OrgCreditAssignmentHelper.createOrgCreditAssignment(req.body, assignedBy);
        res.status(200).json({ status: 200, message: "Credit assigned.", data });
    } catch (error) {
        next(error);
    }
};

const editOrgCreditAssignment = async (req, res, next) => {
    try {
        const data = await OrgCreditAssignmentHelper.editOrgCreditAssignment(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const updateOrgCreditAssignment = async (req, res, next) => {
    try {
        const data = await OrgCreditAssignmentHelper.updateOrgCreditAssignment(req.params.id, req.body);
        res.status(200).json({ status: 200, message: "Successfully updated.", data });
    } catch (error) {
        next(error);
    }
};

const listOrgCreditAssignment = async (req, res, next) => {
    try {
        const { status, orgId, creditId, assignedBy, date_from, date_to } = req.query;
        const data = await OrgCreditAssignmentHelper.listOrgCreditAssignment({ status, orgId, creditId, assignedBy, date_from, date_to });
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const listOrgCreditAssignmentPagination = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { status, orgId, creditId, assignedBy, date_from, date_to } = req.query;

        const [assignments, total] = await Promise.all([
            OrgCreditAssignmentHelper.listOrgCreditAssignmentPagination(page, limit, { status, orgId, creditId, assignedBy, date_from, date_to }),
            OrgCreditAssignmentHelper.getOrgCreditAssignmentCount({ status, orgId, creditId, assignedBy, date_from, date_to })
        ]);
        res.status(200).json({
            status: 200,
            message: "Successfully fetched.",
            data: assignments,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        next(error);
    }
};

const deleteOrgCreditAssignment = async (req, res, next) => {
    try {
        const data = await OrgCreditAssignmentHelper.deleteOrgCreditAssignment(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully deleted.", data });
    } catch (error) {
        next(error);
    }
};

Router.post('/create', createOrgCreditAssignment);
Router.get('/list', listOrgCreditAssignment);
Router.get('/list-pagination', listOrgCreditAssignmentPagination);
Router.get('/edit/:id', editOrgCreditAssignment);
Router.put('/update/:id', updateOrgCreditAssignment);
Router.get('/delete/:id', deleteOrgCreditAssignment);
Router.get('/:id', editOrgCreditAssignment);

export default Router;
