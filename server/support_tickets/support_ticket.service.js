import Ticket from './support_ticket.model.js';

const generateTicketId = async () => {
  const count = await Ticket.countDocuments();
  return `TKT-${String(count + 1).padStart(3, '0')}`;
};

const buildQuery = (filters = {}) => {
  const query = { deletedAt: null };
  if (filters.status) query.status = filters.status;
  if (filters.orgId)  query.orgId  = filters.orgId;
  return query;
};

export const createTicket = async (data, orgId) => {
  try {
    const ticket_id = await generateTicketId();
    return await new Ticket({
      orgId,
      ticket_id,
      issue_type:   data.issue_type,
      subject:      data.subject,
      desc:         data.desc,
      priority:     data.priority || 'Normal',
      resolve_text: data.resolve_text || '',
      status:       data.status || 'open',
    }).save();
  } catch (error) {
    throw error;
  }
};

export const listTickets = async (filters = {}) => {
  try {
    const query = buildQuery(filters);
    return await Ticket.find(query).populate('orgId', 'org_name').sort({ createdAt: -1 }).lean();
  } catch (error) {
    throw error;
  }
};

export const editTicket = async (id) => {
  try {
    return await Ticket.findOne({ _id: id, deletedAt: null }).populate('orgId', 'org_name').lean();
  } catch (error) {
    throw error;
  }
};

export const updateTicket = async (id, data, adminInfo = {}) => {
  try {
    const fields = ['issue_type', 'subject', 'desc', 'priority', 'resolve_text', 'status'];
    const updateFields = {};
    for (const field of fields) {
      if (data[field] !== undefined) updateFields[field] = data[field];
    }
    updateFields.updatedAt = new Date();

    const logEntry = {
      date:      new Date(),
      adminId:   adminInfo._id   || null,
      adminName: adminInfo.name  || adminInfo.email || 'Admin',
      comment:   data.resolve_text || '',
      status:    data.status       || '',
    };

    return await Ticket.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: updateFields, $push: { logs: logEntry } },
      { returnDocument: 'after', runValidators: true }
    ).lean();
  } catch (error) {
    throw error;
  }
};

export const deleteTicket = async (id) => {
  try {
    return await Ticket.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date(), status: 'deleted' } },
      { returnDocument: 'before' }
    ).lean();
  } catch (error) {
    throw error;
  }
};
