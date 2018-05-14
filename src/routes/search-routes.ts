import * as express from "express";
import * as url from "url";
import { companyList } from "../helpers/static/companyData";
import { schoolList } from "../helpers/static/schoolData";
import { designationList } from "../helpers/static/designationData";
import { locationList } from "../helpers/static/locationData";
import { degreeList } from "../helpers/static/degreeData";
const router = express.Router();

const logger = require("../config/logger").logger;


router.get("/degrees",
    (req, res, next) => {
        const parsedUrl = url.parse(req.url, true);
        const params = parsedUrl.query;
        const keyword = params.keyword;
        let results= degreeList.filter(item => item.name.toLowerCase().indexOf(keyword.toLowerCase())> -1 );
        const length= results.length;

        console.log("keyword", keyword, length);
        return res.json(results.slice(0, Math.min(length, 10)));
}); 

router.get("/location",
    (req, res, next) => {
        const parsedUrl = url.parse(req.url, true);
        const params = parsedUrl.query;
        const keyword = params.keyword;
        let results= locationList.filter(item => item.name.toLowerCase().startsWith(keyword.toLowerCase()) );
        const length= results.length;

        console.log("keyword", keyword, length);
        return res.json(results.slice(0, Math.min(length, 10)));
});
router.get("/company",
    (req, res, next) => {
        const parsedUrl = url.parse(req.url, true);
        const params = parsedUrl.query;
        const keyword = params.keyword;
        let results= companyList.filter(item => item.name.toLowerCase().startsWith(keyword.toLowerCase()) );
        const length= results.length;

        console.log("keyword", keyword, length);
        return res.json(results.slice(0, Math.min(length, 10)));
});
router.get("/school",
    (req, res, next) => {
        const parsedUrl = url.parse(req.url, true);
        const params = parsedUrl.query;
        const keyword = params.keyword;
        let results= schoolList.filter(item => item.name.toLowerCase().indexOf(keyword.toLowerCase())> -1 );
        const length= results.length;

        console.log("keyword", keyword, length);
        return res.json(results.slice(0, Math.min(length, 10)));
});
router.get("/designation",
    (req, res, next) => {
        const parsedUrl = url.parse(req.url, true);
        const params = parsedUrl.query;
        const keyword = params.keyword;
        let results= designationList.filter(item => item.name.toLowerCase().startsWith(keyword.toLowerCase()) );
        const length= results.length;

        console.log("keyword", keyword, length);
        return res.json(results.slice(0, Math.min(length, 10)));
});

export default router;