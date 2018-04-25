import * as express from "express";
import { companyList } from "../helpers/static/companyData";
import { schoolList } from "../helpers/static/schoolData";
import { designationList } from "../helpers/static/designationData";
import { locationList } from "../helpers/static/locationData";
const router = express.Router();

const logger = require("../config/logger").logger;

router.get("/location/:keyword",
    (req, res, next) => {
        const keyword = req.params.keyword;
        let results= locationList.filter(item => item.name.toLowerCase().startsWith(keyword.toLowerCase()) );
        const length= results.length;

        console.log("keyword", keyword, length);
        return res.json(results.slice(0, Math.min(length, 10)));
});
router.get("/company/:keyword",
    (req, res, next) => {
        const keyword = req.params.keyword;
        let results= companyList.filter(item => item.name.toLowerCase().startsWith(keyword.toLowerCase()) );
        const length= results.length;

        console.log("keyword", keyword, length);
        return res.json(results.slice(0, Math.min(length, 10)));
});
router.get("/school/:keyword",
    (req, res, next) => {
        const keyword = req.params.keyword;
        let results= schoolList.filter(item => item.name.toLowerCase().indexOf(keyword.toLowerCase())> -1 );
        const length= results.length;

        console.log("keyword", keyword, length);
        return res.json(results.slice(0, Math.min(length, 10)));
});
router.get("/designation/:keyword",
    (req, res, next) => {
        const keyword = req.params.keyword;
        let results= designationList.filter(item => item.name.toLowerCase().startsWith(keyword.toLowerCase()) );
        const length= results.length;

        console.log("keyword", keyword, length);
        return res.json(results.slice(0, Math.min(length, 10)));
});

export default router;