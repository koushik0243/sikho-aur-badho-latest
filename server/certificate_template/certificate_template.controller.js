import express from 'express';
import * as CertificateTemplateService from './certificate_template.service.js';

const Router = express.Router();

const createCertificateTemplate = async (req, res, next) => {
    try {
        const data = await CertificateTemplateService.createCertificateTemplate(req.body);
        res.status(200).json({ status: 200, message: "Successfully added.", data });
    } catch (error) {
        next(error);
    }
};

const getCertificateTemplate = async (req, res, next) => {
    try {
        const data = await CertificateTemplateService.getCertificateTemplate(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const updateCertificateTemplate = async (req, res, next) => {
    try {
        const data = await CertificateTemplateService.updateCertificateTemplate(req.params.id, req.body);
        res.status(200).json({ status: 200, message: "Successfully updated.", data });
    } catch (error) {
        next(error);
    }
};

const listCertificateTemplates = async (req, res, next) => {
    try {
        const { status } = req.query;
        const data = await CertificateTemplateService.listCertificateTemplates({ status });
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const listCertificateTemplatesPagination = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { status } = req.query;
        const [data, total] = await Promise.all([
            CertificateTemplateService.listCertificateTemplatesPagination(page, limit, { status }),
            CertificateTemplateService.getCertificateTemplateCount({ status })
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

const deleteCertificateTemplate = async (req, res, next) => {
    try {
        const data = await CertificateTemplateService.deleteCertificateTemplate(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully deleted.", data });
    } catch (error) {
        next(error);
    }
};

Router.post('/create', createCertificateTemplate);
Router.get('/list', listCertificateTemplates);
Router.get('/list-pagination', listCertificateTemplatesPagination);
Router.get('/details/:id', getCertificateTemplate);
Router.put('/update/:id', updateCertificateTemplate);
Router.get('/delete/:id', deleteCertificateTemplate);

export default Router;
