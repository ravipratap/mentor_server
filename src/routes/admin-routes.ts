import * as express from "express";
const router = express.Router();
// import * as passport from "passport";
const PassportAuth = require("../config/passport").default;
import * as async from "async";

import { default as User, UserModel, Roles } from "../models/user-model";
import { default as Site, SiteModel } from "../models/site-model";
import { default as Program, ProgramModel } from "../models/program-model";
import * as Authenticate  from "../helpers/authenticate";
import * as AdminServices  from "../helpers/adminServices";
import { Error } from "mongoose";
import * as url from "url";
import Survey, { SurveyModel, SurveyCategory } from "../models/survey-model";

//Handling multipart form data, file uploads
import * as multer from "multer";
import { ImgStore } from "../models/shared-model";
import { ImageModel, ImgType } from "../models/image-model";
import { JSONunflatten } from "../helpers/utilities";
const UPLOAD_PATH = 'uploads';
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(undefined, UPLOAD_PATH);
    },
    filename: function (req, file, cb) {
        cb(undefined, file.fieldname + '-' + Date.now());
    }
});
const upload = multer({ storage: storage });

const logger = require("../config/logger").logger;


router.get("/config",
    (req, res, next) => {
        Site.getSiteByEmailOrDomain(undefined, Authenticate.extractHostname(req.headers.origin + ""), (err: Error, existingSite: SiteModel) => {
            if ( err ) {
                logger.error("error in retreiving site: ", err);
                return next(err);
             }
             logger.debug("site found for signup: ", existingSite?existingSite.toString():existingSite);
             return res.json({
                success: true,
                config:  Authenticate.getSiteConfig(undefined, existingSite)
            });
        });
});


router.post("/theme", 
    PassportAuth.authenticate(),
    PassportAuth.roleAuthorization([Roles.find((element) => element == "SuperAdmin"), Roles.find((element) => element == "SiteAdmin")]),
    (req, res, next) => {

        const user= req.user;
        let siteId = req.body.siteId;
        const theme = req.body.theme;
        if(user.role == "SiteAdmin" || !siteId) {
            siteId = user.site;
        }
        // logger.debug("site: "+ siteId + " theme "+ theme);
        Site.findByIdAndUpdate(siteId, { $set: { "config.theme" : theme } } , { select: "profile config signup_pre signup_post", new: true }, (err: Error, savedSite: SiteModel) => {
            if ( err ) {
                logger.error("error in saving site: ", err);
                return next(err);
            }
            logger.debug("site: ", savedSite?savedSite.toString():savedSite);
            return res.json({
                success: true,
                config: Authenticate.getSiteConfig(undefined, savedSite)
            }); 
        });
});

router.get("/sites", 
    PassportAuth.authenticate(),
    PassportAuth.roleAuthorization([Roles.find((element) => element == "SuperAdmin")]),
    (req, res, next) => {

        const parsedUrl = url.parse(req.url, true); // true to get query as object
        const params = parsedUrl.query;
        const pageSize = 9;
        let skip = 0;
        let query: any = {};
        skip= (<number>params.page) * pageSize;
        if(params.search) {
            query["profile.company"]={ $regex : new RegExp("^" + params.search.toLowerCase(), "i") }; 
        }
        // logger.debug("params: ", JSON.stringify(params));
        // logger.debug("query: ", query);

        Site.find(query,"profile license config",{ sort: { "createdAt" : -1 }, limit: pageSize, skip: skip }, (err: Error, sites: SiteModel[]) => {
            if ( err ) {
                logger.error("error in retreiving site: ", err);
                return next(err);
            }
            logger.debug("sites found for response: ", sites?sites.toString() : undefined);
            res.json({sites : sites});
        });    
});



router.post("/saveSite", 
    PassportAuth.authenticate(),
    PassportAuth.roleAuthorization([Roles.find((element) => element == "SuperAdmin")]),
    (req, res, next) => {
        let site = <SiteModel>req.body;
        logger.debug("site: ",site);
        if(site._id){
            Site.findByIdAndUpdate(site._id,site, {select: "profile  license config", new: true}, (err: Error, savedSite: SiteModel) => {
                if ( err ) {
                    logger.error("error in saving site: ", err);
                    return next(err);
                }
                logger.debug("site: " + JSON.stringify(savedSite));
                return res.json({
                    success: true,
                    site: savedSite
                }); 
            });
        } else {
            new Site(site).save((err: Error, savedSite: SiteModel) => {
                if ( err ) {
                    logger.error("error in saving site: ", err);
                    return next(err);
                }
                logger.debug("site created for: ", site?site.toString():site," || saved: ",savedSite?savedSite.toString():savedSite);
                return res.json({
                    success: true,
                    site: savedSite
                }); 
            });
        }
});

router.get("/programs", 
    PassportAuth.authenticate(),
    PassportAuth.roleAuthorization([Roles.find((element) => element == "SuperAdmin"), Roles.find((element) => element == "SiteAdmin"), Roles.find((element) => element == "ProgramAdmin")]),
    (req, res, next) => {
        const parsedUrl = url.parse(req.url, true); // true to get query as object
        const params = parsedUrl.query;
        const pageSize = 9;
        let skip = 0;
        let siteId = params.siteId;
        if(req.user.role != Roles.find((element) => element == "SuperAdmin") || !siteId) {
            siteId = req.user.site;
        }
        let query: any = {site: siteId};
        if(req.user.role == "ProgramAdmin") {
            query["program_admins.id"] = req.user._id;
        }
        skip= (<number>params.page) * pageSize;
        if(params.search) {
            query["profile.name"]={ $regex : new RegExp("^" + params.search.toLowerCase(), "i") };
        }
        logger.debug("params: ", JSON.stringify(params));
        logger.debug("query: ", query);

        Program.find(query,"site profile",{ sort: { "createdAt" : -1 }, limit: pageSize, skip: skip }, (err: Error, programs: ProgramModel[]) => {
            if ( err ) {
                logger.error("error in retreiving programs: ", err);
                return next(err);
            }
            logger.debug("programs found for response: ", programs?programs.toString():programs);
            res.json({programs : programs});
        });    
});


router.post("/saveProgram", 
    PassportAuth.authenticate(),
    upload.single('picture'),
    PassportAuth.roleAuthorization([Roles.find((element) => element == "SuperAdmin"), Roles.find((element) => element == "SiteAdmin"), Roles.find((element) => element == "ProgramAdmin")]),
    (req, res, next) => {


        let newImage: ImageModel;
        let originalName: string;
        if(req.file){
            // logger.debug('req.picture.filename: '+ req.file.filename);
            const fileNameFull= req.file.destination+'/'+req.file.filename;
            // logger.debug('req.picture.filename: '+ fileNameFull);
            newImage=<ImageModel>{};
            newImage.img_path= fileNameFull;
            originalName = req.file.originalname;
            logger.debug("Uploaded File", newImage);
        }
        // logger.debug("body:", req.body);
        let dataPassed = JSONunflatten(req.body);
        let defaultChanged= dataPassed.defaultChanged? true: false;
        if(defaultChanged) delete dataPassed.defaultChanged;
        let program = <ProgramModel>dataPassed;
        logger.debug("program", program);
        logger.debug("/||newImage", newImage, originalName );
        async.waterfall([
            async.constant(req.user, newImage, originalName, ImgType.find((element) => element == "program")),
            Authenticate.uploadImage,
            Authenticate.saveImage,
            async.apply(AdminServices.updateProgram, req.user, program, defaultChanged)
        ],  (err, result:any) => {

            if (err) { 
                res.json({success : false});
            } else {
                logger.debug("updateProgram result", result?result.toString():result);
                res.json({
                    success : true,
                    program: result
                });
            }
        }); 
});


router.get("/survey", 
    PassportAuth.authenticate(),
    (req, res, next) => {
        const parsedUrl = url.parse(req.url, true); // true to get query as object
        const params = parsedUrl.query;
        const pageSize = 9;
        let skip = 0;
        let siteId = params.site;
        if(req.user.role != Roles.find((element) => element == "SuperAdmin")|| !siteId) {
            siteId = req.user.site;
        }
        let query: any = {};
        if(params.surveyId) {
             query["_id"] = params.surveyId; 
        } else {
            // query["profile"] = {}
            if(siteId) { query["profile.site"] = siteId; }
            if(params.program) { query["profile.program"] = params.program; }
            if(params.category) { query["profile.category"] = params.category; }
            if(params.invite_code) { query["profile.invite_code"] = params.invite_code; }
        }
        logger.debug("params: ", JSON.stringify(params));
        logger.debug("query: ", query);

        Survey.findOne(query,"profile questions", (err: Error, survey: SurveyModel[]) => {
            if ( err ) {
                logger.error("error in retreiving programs: ", err);
                return next(err);
            }
            logger.debug("survey found for response: ", survey?survey.toString():survey);
            res.json({survey : survey});
        });    
});


router.post("/saveSurvey", 
    PassportAuth.authenticate(),
    (req, res, next) => {
        let is_default:boolean;
        if(req.body.profile && req.body.profile.is_default) {
            is_default = req.body.profile.is_default;
            delete req.body.profile.is_default;
        }
        let survey = <SurveyModel>req.body;
        if(!survey.profile.site || req.user.role != Roles.find((element) => element == "SuperAdmin")){
            survey.profile.site=req.user.site;
        }
        if(req.user.role == Roles.find((element) => element == "User") && (survey.profile.category == SurveyCategory.find((element) => element == "Signup") || survey.profile.category == SurveyCategory.find((element) => element == "PostSignup") || survey.profile.category == SurveyCategory.find((element) => element == "Program Review"))) {
            return res.status(401).send({msg : "Incorrect role authorization"}); 
        }
        if(survey._id){
            let query: any = { "_id" : survey._id };
            logger.debug("query: ", query);
            Survey.findOneAndUpdate(query, survey, {select: "questions profile", new: true}, (err: Error, savedSurvey: SurveyModel) => {
                if ( err ) {
                    logger.error("error in saving survey: ", err);
                    return next(err);
                }
                logger.debug("survey: ", savedSurvey?savedSurvey.toString():savedSurvey);
                return res.json({
                    success: true,
                    survey: savedSurvey
                });
            });
        } else {
            new Survey(survey).save((err: Error, savedSurvey: SurveyModel) => {
                if ( err ) {
                    logger.error("error in saving survey: ", err);
                    return next(err);
                }
                logger.debug("survey created: ", survey?survey.toString():survey, savedSurvey?savedSurvey.toString():savedSurvey);
                if(savedSurvey && is_default && (savedSurvey.profile.category == SurveyCategory.find( (element) => element == "Signup")|| savedSurvey.profile.category == SurveyCategory.find( (element) => element == "PostSignup"))) {
                    let updateJson:any={};
                    if(savedSurvey.profile.category == SurveyCategory.find( (element) => element == "Signup")){
                        updateJson["signup_pre"] = { survey: savedSurvey._id, program: survey.profile.program };
                    } else {
                        updateJson["signup_post"] = { survey: savedSurvey._id, program: survey.profile.program };
                    }
                    logger.debug("updateJson", JSON.stringify(updateJson));
                    Site.findByIdAndUpdate(survey.profile.site, { $addToSet: updateJson },  { select: "profile config signup_pre signup_post", new: true }, (errata: Error, savedSite: SiteModel) => {
                        if ( errata ) {
                            logger.error("error in saving site config for survey: ", errata);
                            savedSurvey.remove((error: any, product:SurveyModel) => {
                                if ( error ) {
                                    logger.error("error in rolling back  survey save: ", error);
                                }
                                return next(error);
                            });
                        }
                        logger.debug("site saved for survey", savedSite? savedSite.toString(): undefined);
                        return res.json({
                            success: true,
                            survey: savedSurvey
                        }); 
                    });
                } else {
                    return res.json({
                        success: true,
                        survey: savedSurvey
                    }); 
                } 
            });
        }
});


router.get("/adminList", 
    PassportAuth.authenticate(),
    PassportAuth.roleAuthorization([Roles.find((element) => element == "SuperAdmin"), Roles.find((element) => element == "SiteAdmin"), Roles.find((element) => element == "ProgramAdmin")]),
    (req, res, next) => {
        const parsedUrl = url.parse(req.url, true); // true to get query as object
        const params = parsedUrl.query;
        let siteId = params.site;
        if(req.user.role != Roles.find((element) => element == "SuperAdmin") || !siteId) {
            siteId = req.user.site;
        }
        let programId = params.programId;
        if(!programId && req.user.role == Roles.find((element) => element != "SuperAdmin")) {
            return res.status(401).send({msg : "Incorrect role authorization"}); 
        }
        async.waterfall([
            async.constant(req.user, programId, siteId),
            AdminServices.getAdmins,
            AdminServices.fillAdminDetails
        ],  (err, result:any) => {
            
            if (err) { 
                res.json({success : false});
            } else {
                // logger.debug("result.img.thumbnail", result.img.thumbnail, result.img);
                res.json({
                    success : true,
                    users: result
                });
            }
        }); 
});


router.post("/saveAdmins", 
    PassportAuth.authenticate(),
    PassportAuth.roleAuthorization([Roles.find((element) => element == "SuperAdmin"), Roles.find((element) => element == "SiteAdmin"), Roles.find((element) => element == "ProgramAdmin")]),
    (req, res, next) => {
        let siteId = req.body.site;
        if(req.user.role != Roles.find((element) => element == "SuperAdmin") || !siteId) {
            siteId = req.user.site;
        }
        async.waterfall([
            async.constant(req.user, req.body.programId, siteId),
            AdminServices.getAdmins,
            async.apply(AdminServices.addUserDetails, siteId, req.body.emails?req.body.emails:[], req.body.mobiles?req.body.mobiles:[]),
            async.apply(AdminServices.keepExistingProgramAdmins, siteId),
            AdminServices.setSiteAdmins,
            AdminServices.setProgramAdmins,
            AdminServices.resetAsUsers,
            async.apply(AdminServices.setAllAdmins, siteId)
        ],  (err, result:any) => {
            if (err) { 

                res.json({success : false});
            } else {
                // logger.debug("result.img.thumbnail", result.img.thumbnail, result.img);
                res.json({
                    success : true,
                    users: result
                });
            }
        }); 
});

router.get("/transact1",
    PassportAuth.authenticate(),
    PassportAuth.recentlyLoggedIn(),
    (req, res, next) => {
    res.json({user : req.user});
});

export default router;