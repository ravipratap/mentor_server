import * as express from "express";
const router = express.Router();
import * as passport from "passport";
import * as url from "url";
import * as jwt from "jsonwebtoken";
import * as async from "async";

import { default as User, UserModel, Roles, ApplicationStatus } from "../models/user-model";
import { default as Site, SiteModel } from "../models/site-model";
import { default as Image, ImageModel, ImgType } from "../models/image-model";
import * as Authenticate  from "../helpers/authenticate";
import { Error } from "mongoose";

//Handling multipart form data, file uploads
import * as multer from "multer";
import { ImgStore, SurveyResponseModel } from "../models/shared-model";
import * as AdminServices  from  "../helpers/adminServices";
import { SurveyModel, SurveyCategory } from "../models/survey-model";
import { JSONunflatten } from "../helpers/utilities";

const UPLOAD_PATH = 'uploads';
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOAD_PATH)
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now())
    }
});
const upload = multer({ storage: storage });

const logger = require("../config/logger").logger;

router.post("/signup", (req, res, next) => {
    Site.getSiteByEmailOrDomain(Authenticate.extractEmailHostname(req.body.login.email), Authenticate.extractHostname(req.headers.origin + ""), (err: Error, existingSite: SiteModel) => {
        if ( err ) {
            logger.error("error in retreiving site: " , err);
            return next(err);
         }
        User.getUserByMobileOrEmail(req.body.login.email, req.body.login.mobile, existingSite._id, "site login sign profile pic logs programs", (err: Error, existingUser: UserModel) => {
            if ( err ) {
                logger.error("error in retreiving user: " , err);
                 return next(err);
             }
             let action: string = "create";
             if(existingUser && existingUser.logs && existingUser.logs.status && existingUser.logs.status == ApplicationStatus.find((element) => element == "Rejected")){
                 action = "rejected";
             } else if(existingUser && existingUser.verified){
                action = "decline";
            } else if (existingUser && !existingUser.verified){
                action = "overwrite";
            }
            logger.debug("action", action);
             switch(action){
                 case "rejected": {
                     return res.json({success: false, msg: "Permission to sign in is denied. Please contact support."});
                 }
                 case "decline": {
                     return res.json({success: false, msg: "User exits with email address. Please sign in with email"});
                 }
                 case "overwrite": { 

                    async.waterfall([
                        async.constant(<UserModel>req.body, existingUser, true, undefined),
                        Authenticate.updateProfile,
                        async.apply(AdminServices.populateSignUpForm, true, existingSite, undefined) 
                    ],  (err, result:any) => {
                        logger.debug("overwrite result", err, JSON.stringify(result));
                        if (err) { 
                            return res.json({success : false});
                        } else { 
                            const tokenData = Authenticate.getJWTtoken(result.user);
                            return res.json({
                                success: true,
                                token: "JWT " + tokenData.token,
                                user: tokenData.userForToken,
                                config: Authenticate.getSiteConfig(result.user, existingSite),
                                survey: result.survey,
                                surveyResponse: result.surveyResponse,
                                emailVerify: result.emailVerify,
                                mobileVerify: result.mobileVerify
                            });
                        }
                    }); 
                    break; 
                 }
                 case "create": { 
                    async.waterfall([
                        async.constant(<UserModel>req.body, existingSite, undefined),
                        Authenticate.createProfile,
                        async.apply(AdminServices.populateSignUpForm, true, existingSite, undefined) 
                    ],  (err, result:any) => {
                        logger.debug("create result", err, result?result.toString():result);
                        if (err){ 
                            return res.json({success : false});; 
                        } else { 
                            const tokenData = Authenticate.getJWTtoken(result.user);
                            return res.json({
                                success: true,
                                token: "JWT " + tokenData.token,
                                user: tokenData.userForToken,
                                config: Authenticate.getSiteConfig(result.user, existingSite),
                                survey: result.survey,
                                surveyResponse: result.surveyResponse,
                                emailVerify: result.emailVerify,
                                mobileVerify: result.mobileVerify
                            });
                        }
                    }); 
                    break; 
                 }
             }
     
         });
    });
});

router.post("/social", (req, res, next) => {

    if ( !req.body.login.email && !req.body.login.mobile ) {
        return res.json({success: false, msg: "Social networks need to share email address or mobile for sign in"});
    }
    Site.getSiteByEmailOrDomain(Authenticate.extractEmailHostname(req.body.login.email), Authenticate.extractHostname(req.headers.origin + ""),  (err: Error, existingSite: SiteModel) => {
        if ( err ) {
            logger.error("error in retreiving site: " , err);
            return next(err);
         }
         User.getUserByMobileOrEmail(req.body.login.email, undefined, existingSite._id, "site login sign profile pic logs programs", (err: Error, existingUser: UserModel) => {
            if ( err ) {
                logger.error("error in retreiving user: " , err);
                 return next(err);
             }
             let action: string = "create";
             if(existingUser && existingUser.logs && existingUser.logs.status && existingUser.logs.status == ApplicationStatus.find((element) => element == "Rejected")){
                 action = "rejected";
             } else if(existingUser && existingUser.login.email_verified){
                 action = "decline";
                 if(req.body.login.email_verified) action = "update"
             } else if (existingUser && !existingUser.login.email_verified){
                 action = "overwrite";
             }
             logger.debug("action", action)
             switch(action){
                 case "rejected": {
                     return res.json({success: false, msg: "Permission to sign in is denied. Please contact support."});
                 }
                 case "decline": {
                     return res.json({success: false, msg: "User exits with email address. Please sign in with email"});
                 }
                 case "update": { 
                    let newImage:ImageModel
                    if(!(existingUser.pic && existingUser.pic.img_id) && !req.body.picture.is_silhouette){ // update Pic
                        newImage= <ImageModel>{};
                        newImage.img_path= req.body.picture.url + (req.body.picture.provider == "GOOGLE" ? "?sz=150" : "");
                        logger.debug("Uploaded File", newImage?newImage.toString():newImage);
                    }
                    if(req.body.picture) delete  req.body.picture;
                    async.waterfall([
                        async.constant(undefined, newImage, undefined, ImgType.find((element) => element == "profile")),
                        Authenticate.uploadImage,
                        Authenticate.saveImage,
                        async.apply(Authenticate.updateProfile, <UserModel>req.body, existingUser, false),
                        async.apply(AdminServices.populateSignUpForm, true, existingSite, undefined) 
                    ],  (err, result:any) => {
                        logger.debug("result", err, result?result.toString():result);
                        if (err) { 
                            return res.json({success : false});; 
                        } else { 
                            const tokenData = Authenticate.getJWTtoken(result.user);
                            return res.json({
                                success: true,
                                token: "JWT " + tokenData.token,
                                user: tokenData.userForToken,
                                config: Authenticate.getSiteConfig(result.user, existingSite),
                                survey: result.survey,
                                surveyResponse: result.surveyResponse,
                                emailVerify: result.emailVerify,
                                mobileVerify: result.mobileVerify
                            });
                        }
                    }); 
                    break; 
                 }
                 case "overwrite": { 
                    let newImage:ImageModel
                    if(!req.body.picture.is_silhouette){
                        newImage= <ImageModel>{};
                        newImage.img_path= req.body.picture.url + (req.body.picture.provider == "GOOGLE" ? "?sz=150" : "");
                        logger.debug("Uploaded File", newImage?newImage.toString():newImage);
                    }
                    if(req.body.picture) delete  req.body.picture;
                    async.waterfall([
                        async.constant(undefined, newImage, undefined, ImgType.find((element) => element == "profile")),
                        Authenticate.uploadImage,
                        Authenticate.saveImage,
                        async.apply(Authenticate.updateProfile, <UserModel>req.body, existingUser, true),
                        async.apply(AdminServices.populateSignUpForm, true, existingSite, undefined) 
                    ],  (err, result:any) => {
                        logger.debug("result", err, result?result.toString():result);
                        if (err) { 
                            return res.json({success : false});; 
                        } else { 
                            const tokenData = Authenticate.getJWTtoken(result.user);
                            return res.json({
                                success: true,
                                token: "JWT " + tokenData.token,
                                user: tokenData.userForToken,
                                config: Authenticate.getSiteConfig(result.user, existingSite),
                                survey: result.survey,
                                surveyResponse: result.surveyResponse,
                                emailVerify: result.emailVerify,
                                mobileVerify: result.mobileVerify
                            });
                        }
                    }); 
                    break; 
                 }
                 case "create": { 
                    let newImage:ImageModel
                    if(!req.body.picture.is_silhouette){
                        newImage= <ImageModel>{};
                        newImage.img_path= req.body.picture.url + (req.body.picture.provider == "GOOGLE" ? "?sz=150" : "");
                        logger.debug("Uploaded File", newImage?newImage.toString():newImage);
                    }
                    if(req.body.picture) delete  req.body.picture;
                    async.waterfall([
                        async.constant(undefined, newImage, undefined, ImgType.find((element) => element == "profile")),
                        Authenticate.uploadImage,
                        Authenticate.saveImage,
                        async.apply(Authenticate.createProfile, <UserModel>req.body, existingSite),
                        async.apply(AdminServices.populateSignUpForm, true, existingSite, undefined) 
                    ],  (err, result:any) => {
                        logger.debug("result", err, result?result.toString():result);
                        if (err) { 
                            return res.json({success : false});; 
                        } else { 
                            const tokenData = Authenticate.getJWTtoken(result.user);
                            return res.json({
                                success: true,
                                token: "JWT " + tokenData.token,
                                user: tokenData.userForToken,
                                config: Authenticate.getSiteConfig(result.user, existingSite),
                                survey: result.survey,
                                surveyResponse: result.surveyResponse,
                                emailVerify: result.emailVerify,
                                mobileVerify: result.mobileVerify
                            });
                        }
                    }); 
                    break; 
                 }
             }
     
         });
    });
});
router.get("/mailOpen", (req, res, next) => {
    const parsedUrl = url.parse(req.url, true); // true to get query as object
    const params = parsedUrl.query;
    logger.debug("Mail Opened", params);
    var buf = new Buffer([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
        0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x2c,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02,
        0x02, 0x44, 0x01, 0x00, 0x3b]);
        res.writeHead(200, {'Content-Type': 'image/png'});
        res.end(buf,'binary');
});
router.post("/signin", (req, res, next) => {
    logger.debug("signing of " + req.body.username + "from domain: "+ Authenticate.extractHostname(req.headers.origin + "") );
    Site.getSiteByEmailOrDomain(Authenticate.extractEmailHostname(req.body.username), Authenticate.extractHostname(req.headers.origin + ""), (err: Error, existingSite: SiteModel) => {
        if ( err ) {
            logger.error("error in retreiving site: " , err);
            return next(err);
        }
        logger.debug("existingSite", req.body.isApp, existingSite?existingSite.toString():existingSite, Authenticate.extractEmailHostname(req.body.username), Authenticate.extractHostname(req.headers.origin + ""));
        const username = req.body.username;
        const password = req.body.password;

        User.getUserByUsername(username, existingSite._id, req.body.isApp, "site login sign profile pic logs programs pass", (err: Error, user: UserModel) => {
            if ( err ) throw err;
            if (!user) {
                return res.json({success: false, msg: "User not found"});
            }
            if (!user.pass.password) {
                return res.json({success: false, msg: "Password mismatch. Change your password using Forgot Password link."});
            }
            User.comparePassword(password, user.pass.password, (err: Error, isMatch: boolean) => {
                if ( err ) {
                    logger.error("error in retreiving user: " , err);
                    return next(err);
                }
                if ( isMatch ) {
                    logger.debug("User matched:  _id: ", user._id.toString(), "profile: ", user.profile.toString(), "login: ", user.login.toString(), "site:: ", user.site.toString());
                    if(existingSite._id.equals(user.site)){
                        async.waterfall([
                            async.constant(user),
                            Authenticate.updateUserForSignIn,
                            async.apply(AdminServices.populateSignUpForm, true, existingSite, undefined) 
                        ],  (err, result:any) => {
                            logger.debug("overwrite result", err, result? JSON.stringify(result):result);
                            if (err) { 
                                return res.json({success : false});
                            } else { 
                                const tokenData = Authenticate.getJWTtoken(result.user);
                                return res.json({
                                    success: true,
                                    token: "JWT " + tokenData.token,
                                    user: tokenData.userForToken,
                                    config: Authenticate.getSiteConfig(result.user, existingSite),
                                    survey: result.survey,
                                    surveyResponse: result.surveyResponse,
                                    emailVerify: result.emailVerify,
                                    mobileVerify: result.mobileVerify
                                });
                            }
                        }); 
                        // const tokenData = Authenticate.getJWTtoken( user);
                        // logger.debug("tokenData: ", JSON.stringify(tokenData));
                        // return res.json({
                        //     success: true,
                        //     token: "JWT " + tokenData.token,
                        //     user: tokenData.userForToken,
                        //     config:  Authenticate.getSiteConfig(user, existingSite)
                        // });
                    } else { // For Site to be changed based on username(non domain) (Only to be used in app)
                        Site.findById(user.site, "profile config",  (err: Error, newSite: SiteModel) => {
                            if ( err ) {
                                logger.error("error in retreiving site: " , err);
                                return next(err);
                            }
                            logger.debug("site found for signup: ",newSite?newSite.toString():newSite);    
                            async.waterfall([
                                async.constant(user),
                                Authenticate.updateUserForSignIn,
                                async.apply(AdminServices.populateSignUpForm, true, newSite, undefined) 
                            ],  (err, result:any) => {
                                logger.debug("updateUserForSignIn result", err, result?result.toString():result);
                                if (err) { 
                                    return res.json({success : false});
                                } else { 
                                    const tokenData = Authenticate.getJWTtoken(result.user);
                                    return res.json({
                                        success: true,
                                        token: "JWT " + tokenData.token,
                                        user: tokenData.userForToken,
                                        config: Authenticate.getSiteConfig(result.user, existingSite),
                                        survey: result.survey,
                                        surveyResponse: result.surveyResponse,
                                        emailVerify: result.emailVerify,
                                        mobileVerify: result.mobileVerify
                                    });
                                }
                            }); 
                        });
                    }
                } else {
                    return res.json({success: false, msg: "Password mismatch"});
                }
            });
        });
    });
});

router.post('/signUpForm', passport.authenticate('jwt', {session: false}), upload.single('picture'), (req, res, next) => {
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
        let requestBody = JSONunflatten(req.body);
        const programId = requestBody.extra.program;
        const preSignup: boolean = requestBody.extra.category == SurveyCategory.find((element) => element == "Signup");
        const is_mentor: boolean = requestBody.extra.is_mentor? true: false;
        const userProgramId = requestBody.extra.userProgramId;
        logger.debug("requestBody.extra", requestBody.extra, programId, preSignup, is_mentor, userProgramId);
        delete requestBody.extra;
        let surveyResponse = <SurveyResponseModel> requestBody;
        logger.debug("surveyResponse", surveyResponse);
        logger.debug("/||newImage", newImage, originalName );
        async.waterfall([
            async.constant(req.user, newImage, originalName, ImgType.find((element) => element == "profile")),
            Authenticate.uploadImage,
            Authenticate.saveImage,
            async.apply(AdminServices.populateUserFromSignUpForm, preSignup, is_mentor, userProgramId, programId, req.user, surveyResponse),
            async.apply(AdminServices.populateSignUpForm, true, undefined, undefined) 
        ],  (err, result:any) => {
            if (err)
            { 
                res.json({success : false});; 
            } else {
                logger.debug("updateProgram result", result?result.toString():result);
                res.json({
                    success : true,
                    survey: result.survey,
                    surveyResponse: result.surveyResponse,
                    emailVerify: result.emailVerify,
                    mobileVerify: result.mobileVerify
                });
            }
        });   
});

router.get("/profile", passport.authenticate("jwt", {session: false}), (req, res, next) => {
    logger.debug("inside profile route");
    logger.debug(req.user);
    User.findById( req.user._id, "site login profile sign pic", ( err: Error, userFromDb: UserModel ) => {
        if ( err ) throw err;
        if ( !userFromDb ) {
            return res.json({success: false, msg: "User not found"});
        }
        logger.debug(userFromDb?userFromDb.toString():userFromDb);

        
        // const userForDisplay = {
        //     name: userFromDb.fullName,
        //     email: userFromDb.login.email,
        //     verified: userFromDb.verified,
        //     role: userFromDb.login.role,
        //     mobile: userFromDb.login.mobile,
        //     email_verified: userFromDb.login.email_verified,
        //     mobile_verified: userFromDb.login.mobile_verified,
        //     path: userFromDb.profile.img_path,
        //     thumbnail: userFromDb.sign.thumbnail,
        //     img_store: userFromDb.sign.img_store
        // };
        res.json({user : userFromDb});
    });

});
router.post('/profilePicture', passport.authenticate('jwt', {session: false}), upload.single('picture'), (req, res, next) => {
    if(req.file){
        const fileNameFull= req.file.destination+'/'+req.file.filename;
        logger.debug('req.picture.filename: '+ fileNameFull);
        let newImage=<ImageModel>{};
        newImage.img_path= fileNameFull;
        logger.debug("Uploaded File", newImage?newImage.toString():newImage);
        async.waterfall([
            async.constant(req.user, newImage, req.file.originalname, ImgType.find((element) => element == "profile")),
            Authenticate.uploadImage,
            Authenticate.saveImage,
            async.apply(Authenticate.updateUserProfilePic, req.user, "pic sign")
        ],  (err, result:any) => {
            if (err)
            { 
                res.json({success : false});; 
            } else {
                // logger.debug("result.img.thumbnail", result.img.thumbnail, result.img);
                res.json({
                    success : true,
                    secure_url: result.img.img_path,
                    thumbnail: result.img.thumbnail_path
                });
            }
        });
    } 
          
});

router.get("/admin",
    passport.authenticate("jwt", {session: false}),
    Authenticate.roleAuthorization(["SuperAdmin"]),
    (req, res, next) => {
    // res.json({user : req.user});
});


router.get("/transact",
    passport.authenticate("jwt", {session: false}),
    Authenticate.recentlyLoggedIn(),
    (req, res, next) => {
    res.json({user : req.user});
});

router.get("/test", (req, res, next) => {
    res.json({"test": "success"});
});



export default router;