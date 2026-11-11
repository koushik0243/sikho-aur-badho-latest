import express from 'express';
import mongoose from 'mongoose';
import * as TicketHelper from './support_ticket.service.js';

const Router = express.Router();

const resolveOrgId = async (req) => {
  if (req.body.orgId) return req.body.orgId;
  const userId = req.user?._id;
  if (!userId) return null;
  const User = mongoose.model('Users');
  const user = await User.findById(userId).select('orgId').lean();
  return user?.orgId ?? null;
};

const createTicket = async (req, res, next) => {
  try {
    const orgId = await resolveOrgId(req);
    if (!orgId) {
      return res.status(400).json({ status: 400, message: "orgId is required." });
    }
    const data = await TicketHelper.createTicket(req.body, orgId);
    res.status(200).json({ status: 200, message: "Ticket raised successfully.", data });
  } catch (error) {
    next(error);
  }
};

const listTickets = async (req, res, next) => {
  try {
    const { status, orgId } = req.query;
    const data = await TicketHelper.listTickets({ status, orgId });
    res.status(200).json({ status: 200, message: "Successfully fetched.", data });
  } catch (error) {
    next(error);
  }
};

const editTicket = async (req, res, next) => {
  try {
    const data = await TicketHelper.editTicket(req.params.id);
    res.status(200).json({ status: 200, message: "Successfully fetched.", data });
  } catch (error) {
    next(error);
  }
};

const updateTicket = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    let adminInfo = { _id: userId, name: '', email: req.user?.email || '' };
    if (userId) {
      try {
        const User = mongoose.model('Users');
        const u = await User.findById(userId).select('name email').lean();
        if (u) { adminInfo.name = u.name || ''; adminInfo.email = u.email || adminInfo.email; }
      } catch {}
    }
    const data = await TicketHelper.updateTicket(req.params.id, req.body, adminInfo);
    res.status(200).json({ status: 200, message: "Successfully updated.", data });
  } catch (error) {
    next(error);
  }
};

const deleteTicket = async (req, res, next) => {
  try {
    const data = await TicketHelper.deleteTicket(req.params.id);
    res.status(200).json({ status: 200, message: "Successfully deleted.", data });
  } catch (error) {
    next(error);
  }
};

Router.post('/create', createTicket);
Router.get('/list', listTickets);
Router.get('/edit/:id', editTicket);
Router.put('/update/:id', updateTicket);
Router.get('/delete/:id', deleteTicket);

export default Router;
