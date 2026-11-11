import express from 'express';
import * as OrgDashboardHelper from './org_dashboard.service.js';

const Router = express.Router();

const getSummary = async (req, res, next) => {
    try {
        const { orgId } = req.query;
        const data = await OrgDashboardHelper.getDashboardSummary(orgId);
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

Router.get('/summary', getSummary);

export default Router;
