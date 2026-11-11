import express from 'express';
import * as ActivityLogHelper from './activity_log.service.js';

const Router = express.Router();

const listActivity = async (req, res, next) => {
  try {
    const { userId } = req.query;
    const data = await ActivityLogHelper.listActivity(userId);
    res.status(200).json({ status: 200, message: 'Successfully fetched.', data });
  } catch (error) {
    next(error);
  }
};

Router.get('/list', listActivity);

export default Router;
