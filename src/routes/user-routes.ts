import * as express from "express";
const router = express.Router();
// import * as passport from "passport";
const PassportAuth = require("../config/passport").default;
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
import * as MailService from "../helpers/mailService";
import * as SmsService from "../helpers/smsService";
import * as AdminServices  from  "../helpers/adminServices";
import * as SurveyServices  from  "../helpers/surveyServices";
import Survey, { SurveyModel, SurveyCategory } from "../models/survey-model";
import { JSONunflatten, convertUsertoString } from "../helpers/utilities";
import passport from "../config/passport";

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
                        async.apply(SurveyServices.populateSignUpForm, true, existingSite, undefined) 
                    ],  (err, result:any) => {
                        logger.debug("overwrite result", err, JSON.stringify(result));
                        if (err) { 
                            return res.json({success : false});
                        } else { 
                            const tokenData = PassportAuth.getJWTtoken(result.user);
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
                        async.apply(SurveyServices.populateSignUpForm, true, existingSite, undefined) 
                    ],  (err, result:any) => {
                        logger.debug("create result", err, result?result.toString():result);
                        if (err){ 
                            return res.json({success : false}); 
                        } else { 
                            const tokenData = PassportAuth.getJWTtoken(result.user);
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
                 logger.debug("req.body", req.body);
                 if(req.body.login.email_verified) action = "update";
             } else if (existingUser && !existingUser.login.email_verified){
                 action = "overwrite";
             }
             logger.debug("action", action);
             switch(action){
                 case "rejected": {
                     return res.json({success: false, msg: "Permission to sign in is denied. Please contact support."});
                 }
                 case "decline": {
                     return res.json({success: false, msg: "User exists with email address. Please sign in with email"});
                 }
                 case "update": { 
                    let newImage:ImageModel;
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
                        async.apply(SurveyServices.populateSignUpForm, true, existingSite, undefined) 
                    ],  (err, result:any) => {
                        logger.debug("result", err, result?result.toString():result);
                        if (err) { 
                            return res.json({success : false}); 
                        } else { 
                            const tokenData = PassportAuth.getJWTtoken(result.user);
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
                    let newImage:ImageModel;
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
                        async.apply(SurveyServices.populateSignUpForm, true, existingSite, undefined) 
                    ],  (err, result:any) => {
                        logger.debug("result", err, result?result.toString():result);
                        if (err) { 
                            return res.json({success : false}); 
                        } else { 
                            const tokenData = PassportAuth.getJWTtoken(result.user);
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
                    let newImage:ImageModel;
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
                        async.apply(SurveyServices.populateSignUpForm, true, existingSite, undefined) 
                    ],  (err, result:any) => {
                        logger.debug("result", err, result?result.toString():result);
                        if (err) { 
                            return res.json({success : false}); 
                        } else { 
                            const tokenData = PassportAuth.getJWTtoken(result.user);
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
    const buf = new Buffer([
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
            if ( err ) return next(err);
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
                            async.constant(user, undefined),
                            Authenticate.updateUserForSignIn,
                            async.apply(SurveyServices.populateSignUpForm, true, existingSite, undefined) 
                        ],  (err, result:any) => {
                            logger.debug("overwrite result", err, result? JSON.stringify(result):result);
                            if (err) { 
                                return res.json({success : false});
                            } else { 
                                const tokenData = PassportAuth.getJWTtoken(result.user);
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
                        // const tokenData = PassportAuth.getJWTtoken( user);
                        // logger.debug("tokenData: ", JSON.stringify(tokenData));
                        // return res.json({
                        //     success: true,
                        //     token: "JWT " + tokenData.token,
                        //     user: tokenData.userForToken,
                        //     config:  Authenticate.getSiteConfig(user, existingSite)
                        // });
                    } else { // For Site to be changed based on username(non domain) (Only to be used in app)
                        Site.findById(user.site, "profile config  signup_pre signup_post",  (err: Error, newSite: SiteModel) => {
                            if ( err ) {
                                logger.error("error in retreiving site: " , err);
                                return next(err);
                            }
                            logger.debug("site found for signup: ",newSite?newSite.toString():newSite);    
                            async.waterfall([
                                async.constant(user, undefined),
                                Authenticate.updateUserForSignIn,
                                async.apply(SurveyServices.populateSignUpForm, true, newSite, undefined) 
                            ],  (err, result:any) => {
                                logger.debug("updateUserForSignIn result", err, result?result.toString():result);
                                if (err) { 
                                    return res.json({success : false});
                                } else { 
                                    const tokenData = PassportAuth.getJWTtoken(result.user);
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
//passport.authenticate('jwt', {session: false})

router.post('/signUpForm', PassportAuth.authenticate(), upload.single('picture'), (req, res, next) => {
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
        const category =requestBody.extra.category;
        const is_mentor: boolean = requestBody.extra.is_mentor? true: false;
        const role: string = requestBody.extra.role? requestBody.extra.role: undefined;
        const userProgramId = requestBody.extra.userProgramId;
        const isNonProfileEdit = requestBody.extra.nonProfileEdit;
        logger.debug("requestBody.extra", requestBody.extra, programId, category, is_mentor, userProgramId);
        delete requestBody.extra;
        let surveyResponse = <SurveyResponseModel> requestBody;
        logger.debug("surveyResponse", surveyResponse);
        logger.debug("/||newImage", newImage, originalName );
        if(isNonProfileEdit || category == SurveyCategory.find((element) => element == "Profile")){
            async.waterfall([
                async.constant(category, req.user, surveyResponse, undefined),
                SurveyServices.populateContactFromSignUpForm,
                async.apply(SurveyServices.populateUserFromSignUpForm, role, is_mentor, userProgramId, programId),
                SurveyServices.updateEducationFromSignUpForm,
                SurveyServices.updatePositionFromSignUpForm
            ],  (err, result:any) => {
                
                if (err) { 
                    logger.error("Error in updating profile", err);
                    res.json({success : false, msg: (err as any).msg });
                } else {
                    logger.debug("updatePr0file result", convertUsertoString(result));
                    let aid:string;
                    let email_verified: boolean = result.login.email_verified;
                    let mobile_verified: boolean = result.login.mobile_verified;
                    if(surveyResponse.answers.length == 1 && (surveyResponse.answers[0].category=="Position" || surveyResponse.answers[0].category=="Education")){
                        if(surveyResponse.answers[0].category=="Position"){
                            aid = result.profile.positions[result.profile.positions.length - 1]._id;
                        } else {
                            aid = result.profile.education[result.profile.education.length - 1]._id;
                        }
                    }
                    logger.debug("aid", JSON.stringify(aid));
                    res.json({
                        success : true,
                        aid: aid,
                        email_verified: email_verified,
                        mobile_verified: mobile_verified
                    });
                }
            });
        } else {
            Site.findById(req.user.site, "profile config  signup_pre signup_post",  (errata: Error, existingSite: SiteModel) => {
                if ( errata ) {
                    logger.error("error in retreiving site: " , errata);
                    return next(errata);
                }
                async.waterfall([
                    async.constant(req.user, newImage, originalName, ImgType.find((element) => element == "profile")),
                    Authenticate.uploadImage,
                    Authenticate.saveImage,
                    async.apply(SurveyServices.populateContactFromSignUpForm, category, req.user, surveyResponse),
                    async.apply(SurveyServices.populateUserFromSignUpForm, role, is_mentor, userProgramId, programId),
                    SurveyServices.updateEducationFromSignUpForm,
                    SurveyServices.updatePositionFromSignUpForm,
                    async.apply(SurveyServices.populateSignUpForm, category == SurveyCategory.find((element) => element == "Signup"), existingSite, undefined) 
                ],  (err, result:any) => {
                    
                    if (err) { 
                        res.json({success : false}); 
                    } else {
                        logger.debug("updateProgram result", result?result.toString():undefined);
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
        }   
});

router.post("/saveOTP", (req, res, next) => {
    logger.debug("OTP request ", req.body);
    if (req.headers && req.headers.authorization) {
        let decoded = PassportAuth.decodeToken(req.headers.authorization, (err: Error, decoded:any) => {
            let userFromToken:any;
            if(decoded) {
                userFromToken = PassportAuth.getUserFromDecodedToken(decoded);
                if(req.body.userid != userFromToken._id) return res.status(401).send({msg : "Verifying someone else's account"});
            }
            User.findById(req.body.userid, "site login sign profile pic logs programs pass", (err: Error, user: UserModel) => {
                if ( err ) return next(err);
                let updateJson: any = {};
                if(req.body.OTP) {
                    if(user.login.email_token == req.body.OTP && user.login.email_token_expires > new Date()){
                        updateJson["login.email_verified"] = true;
                    }
                    if(user.login.mobile_otp == req.body.OTP && user.login.mobile_otp_expires > new Date()){
                        updateJson["login.mobile_verified"] = true;
                    }
                } else {
                    if(req.body.emailOTP && req.body.email == user.login.email && user.login.email_token == req.body.emailOTP && user.login.email_token_expires > new Date()){
                        updateJson["login.email_verified"] = true;
                    }
                    if(req.body.mobileOTP && req.body.mobile == user.login.mobile && user.login.mobile_otp == req.body.mobileOTP && user.login.mobile_otp_expires > new Date()){
                        updateJson["login.mobile_verified"] = true;
                    }
                    if(req.body.emailOTP && req.body.mobileOTP && Object.keys(updateJson).length < 2){
                        return res.json({ success: false, msg : "No valid OTP"}); 
                    }
                }
                // logger.debug("decoded", userFromToken);
                if(Object.keys(updateJson).length !== 0){
                    if(req.body.loggedIn){                    
                        if(updateJson["login.email_verified"]){
                            user.login.email_verified = true;
                        }
                        if(updateJson["login.mobile_verified"]){
                            user.login.mobile_verified = true;
                        }
                        user.save((err: Error, savedUser:UserModel) => {
                            if ( err ) return next(err);
                            logger.debug("User with OTP saved", convertUsertoString(savedUser));
                            return res.json({ 
                                success: true,
                                email_verified: savedUser.login.email_verified,
                                mobile_verified: savedUser.login.mobile_verified
                            });
                        });
                    } else {                      
                        let query;
                        if(userFromToken){
                            query = { _id: userFromToken.site };
                        } else {
                            query = {"profile.domain": Authenticate.extractHostname(req.headers.origin + "")};
                        }
                        Site.findOne(query, "profile config signup_pre signup_post", ( err:Error, existingSite: SiteModel ) => {                            
                            async.waterfall([
                                async.constant(user, updateJson),
                                Authenticate.updateUserForSignIn,
                                async.apply(SurveyServices.populateSignUpForm, true, existingSite, undefined) 
                            ],  (err, result:any) => {
                                logger.debug("SignedInWithOTPSaved", err, result? JSON.stringify(result):result);
                                if (err) { 
                                    return res.json({success : false});
                                } else { 
                                    const tokenData = PassportAuth.getJWTtoken(result.user);
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
                }  else {
                    return res.json({ success: false, msg : "No valid OTP"});
                }
            });        
       });
    } else {
        return res.status(401).send({msg : "Incorrect request header"});
    }

});

router.post("/resendOTP", (req, res, next) => {
    logger.debug("OTP resend request ", req.body);
    let updateJson: any = {};
    if(req.body.email){
        let emailOTP = Authenticate.createRandomOTP();
        updateJson["login.email_token"] = emailOTP + "";
        updateJson["login.email_token_expires"] = new Date( Date.now() + 1800 * 1000 ); //30 mins
    } else if(req.body.mobile){
        let mobileOTP = Authenticate.createRandomOTP();
        updateJson["login.mobile_otp"] = mobileOTP + "";
        updateJson["login.mobile_otp_expires"] = new Date( Date.now() + 1800 * 1000 ); //30 mins
    }
    User.findByIdAndUpdate(req.body.userid,
        updateJson,
        {select: "site login sign profile pic programs logs", new: true}, 
        (err: Error, savedUser: UserModel) => {      
            if ( err ) {
                logger.error("error in updating user for resending OTP", err);
                return res.status(500).send({msg : "Un"});
            } else {
                if(req.body.email) {                            
                    MailService.sendVerifyMail(savedUser, undefined, () => {
                        return res.json({success : true});
                    });
                }
                if(req.body.mobile) {
                    SmsService.sendVerifySms(savedUser, undefined, () => {
                        return res.json({success : true});
                    });
                }
            }
    });


});

router.get("/profile",PassportAuth.authenticate(), (req, res, next) => {
    const parsedUrl = url.parse(req.url, true); // true to get query as object
    const params = parsedUrl.query;
    let userId = params._id;
    let programId = params.program;
    let surveyId = params.surveyId;
    if(!userId) userId = req.user._id;
    logger.debug("inside profile route", userId);
    logger.debug(req.user);
    let fields: string;
    let self:boolean = false;
     if(req.user._id == userId) {
        fields = "site login profile sign pic programs logs";
        self = true;
     } else  {
        fields = "site login profile sign pic programs";
     }

    User.findById( userId, fields, ( err: Error, userFromDb: UserModel ) => {
        if ( err ){
            logger.error("error in retreiving user: " , err);
            return next(err);
        }
        if ( !userFromDb ) {
            return res.json({success: false, msg: "User not found"});
        }
        logger.debug(userFromDb?userFromDb.toString():userFromDb);
        if(userFromDb.programs && userFromDb.programs.length > 0){
            let surveyIds: string[] = [];
            let searchQuery:any = {};
            userFromDb.programs.forEach(program => {
                if(programId){
                    if(program.program.toString() == programId){
                        if(program.signup_pre && program.signup_pre.survey) surveyIds.push(program.signup_pre.survey);
                        if(program.signup_post && program.signup_post.survey) surveyIds.push(program.signup_post.survey);
                    }
                } else {
                    if(program.signup_pre && program.signup_pre.survey) surveyIds.push(program.signup_pre.survey);
                    if(program.signup_post && program.signup_post.survey) surveyIds.push(program.signup_post.survey);
                }
            }); 
            if(surveyId){
                surveyId = surveyIds.find(element=> element == surveyId);
                if(surveyId) searchQuery = {_id: surveyId};
            } else if (surveyIds.length>0){
                searchQuery = {_id: {$in: surveyIds}};
            }
            if(Object.keys(searchQuery).length !== 0 ){
                Survey.find(searchQuery, "profile questions", (errata: Error, surveys: SurveyModel[] ) => {
                    if ( err ){
                        logger.error("error in retreiving surveys: " , err);
                        return next(err);
                    }  
                    res.json({user : SurveyServices.getProfileAsSurvey(userFromDb, surveys, self)});
                });

            } else {
                res.json({user : SurveyServices.getProfileAsSurvey(userFromDb, undefined, self)});
            }
        } else {
            res.json({user : SurveyServices.getProfileAsSurvey(userFromDb, undefined, self)});
        }
    });

});
router.post('/profilePicture', PassportAuth.authenticate(), upload.single('picture'), (req, res, next) => {
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
            
            if (err) { 
                res.json({success : false}); 
            } else {
                // logger.debug("result.img.thumbnail", result.img.thumbnail, result.img);
                res.json({
                    success : true,
                    secure_url: result.img.img_path,
                    thumbnail: result.img.thumbnail_path,
                    img_store: result.user.pic.img_store
                });
            }
        });
    } 
          
});

router.get("/admin",
    PassportAuth.authenticate(),
    PassportAuth.roleAuthorization(["SuperAdmin"]),
    (req, res, next) => {
    // res.json({user : req.user});
});


router.get("/transact",
    PassportAuth.authenticate(),
    PassportAuth.recentlyLoggedIn(),
    (req, res, next) => {
    res.json({user : req.user});
});

router.get("/test", (req, res, next) => {
    res.json({"test": "success"});
});



export default router;