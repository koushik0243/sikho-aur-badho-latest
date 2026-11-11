import slugify from 'slugify';
import CertificateTemplate from './certificate_template.model.js';

const generateSlug = (title) => slugify(title, { lower: true, strict: true, trim: true });

const buildQuery = (filters = {}) => {
    const query = { deletedAt: null };
    if (filters.status) query.status = filters.status;
    return query;
};

export const createCertificateTemplate = async (data) => {
    try {
        const title = (data.title || '').trim();
        const desc = (data.desc || '').trim();

        // Duplicate detection is based on the template's HTML content, not its
        // title. The title is freely editable by the admin (e.g. Seed Templates
        // re-run after a rename), so matching on title alone would either miss a
        // real duplicate (title changed, content identical) or wrongly block a
        // genuinely new template that just happens to reuse a title. Content is
        // the actual identity of a template: same content = same template
        // regardless of name; different content = a new template even under a
        // reused name.
        const existing = await CertificateTemplate.findOne({
            desc,
            status: 'active',
            deletedAt: null,
        }).lean();
        if (existing) {
            const err = new Error(`A certificate template with this exact content already exists ("${existing.title}").`);
            err.statusCode = 409;
            throw err;
        }

        const baseSlug = generateSlug(title);
        let slug = baseSlug;
        let counter = 1;
        while (await CertificateTemplate.findOne({ slug }).lean()) {
            slug = `${baseSlug}-${counter++}`;
        }
        return await new CertificateTemplate({
            title,
            slug,
            desc,
            status: data.status || 'active'
        }).save();
    } catch (error) {
        throw error;
    }
};

export const getCertificateTemplate = async (id) => {
    try {
        return await CertificateTemplate.findOne({ _id: id, deletedAt: null }).lean();
    } catch (error) {
        throw error;
    }
};

export const updateCertificateTemplate = async (id, data) => {
    try {
        const updateFields = {};

        if (data.desc !== undefined) {
            const desc = data.desc.trim();

            // Same content-based duplicate guard as create (see comment there),
            // excluding this document itself so re-saving unchanged content works.
            const existing = await CertificateTemplate.findOne({
                desc,
                status: 'active',
                deletedAt: null,
                _id: { $ne: id },
            }).lean();
            if (existing) {
                const err = new Error(`A certificate template with this exact content already exists ("${existing.title}").`);
                err.statusCode = 409;
                throw err;
            }

            updateFields.desc = desc;
        }

        if (data.title !== undefined) {
            const title = data.title.trim();
            updateFields.title = title;

            // Regenerate the slug and, like create, walk to the next free suffix —
            // excluding this document's own current slug from the collision check.
            // Without this, renaming a template can collide with a slug still held
            // by an unrelated (including soft-deleted) document and fail with a
            // raw duplicate-key error, since deleting a template never freed its slug.
            const baseSlug = generateSlug(title);
            let slug = baseSlug;
            let counter = 1;
            while (await CertificateTemplate.findOne({ slug, _id: { $ne: id } }).lean()) {
                slug = `${baseSlug}-${counter++}`;
            }
            updateFields.slug = slug;
        }
        if (data.status !== undefined) updateFields.status = data.status;
        updateFields.updatedAt = new Date();

        return await CertificateTemplate.findOneAndUpdate(
            { _id: id, deletedAt: null },
            { $set: updateFields },
            { returnDocument: 'after', runValidators: true }
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const listCertificateTemplates = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await CertificateTemplate.find(query).sort({ title: 1 }).lean();
    } catch (error) {
        throw error;
    }
};

export const listCertificateTemplatesPagination = async (page, limit, filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await CertificateTemplate.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
    } catch (error) {
        throw error;
    }
};

export const getCertificateTemplateCount = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await CertificateTemplate.countDocuments(query);
    } catch (error) {
        throw error;
    }
};

export const deleteCertificateTemplate = async (id) => {
    try {
        const now = new Date();
        return await CertificateTemplate.findOneAndUpdate(
            { _id: id, deletedAt: null },
            {
                $set: {
                    deletedAt: now,
                    status: 'inactive',
                    // Free up the slug (unique index) so a future template can reuse
                    // this title/slug without colliding with the soft-deleted row.
                    slug: `deleted-${now.getTime()}-${id}`,
                    updatedAt: now,
                },
            },
            { returnDocument: 'after' }
        ).lean();
    } catch (error) {
        throw error;
    }
};
