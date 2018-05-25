

import * as jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import User , { UserModel, Roles, ApplicationStatus} from "../models/user-model";
import Site, { SiteModel } from "../models/site-model";
import Image, { ImageModel, ImgType } from "../models/image-model";
import { ImgStore, SurveyResponseModel } from "../models/shared-model";

import * as fs from "fs";
import * as MailService from "./mailService";
import { SurveyModel } from "../models/survey-model";
import { convertUsertoString } from "./utilities";
const cloudinary = require('cloudinary');

const logger = require("../config/logger").logger;


export let getSiteConfig= (user: UserModel, site: SiteModel): any => {
    let siteConfig: any; 
    if(!user || user.login.role == Roles.find((element) => element == "User")) {
        siteConfig = {
            _id: site._id,
            config: site.config
        };
    } else {
        siteConfig =  {
            _id: site._id,
            config: site.config
        };
    }
    return siteConfig;
};

export let createRandomOTP = () : number => {
    return (100000 + Math.floor(Math.random() * 900000));
};


export let extractHostname = (url: string) => {
    let hostname;
    // find & remove protocol (http, ftp, etc.) and get hostname

    if (url.indexOf("://") > -1) {
        hostname = url.split("/")[2];
    } else {
        hostname = url.split("/")[0];
    }

    // find & remove port number
    hostname = hostname.split(":")[0];
    // find & remove "?"
    hostname = hostname.split("?")[0];

    return hostname;
};


export let extractEmailHostname = (email: string) => {
    let hostname: string;
    if ( email ) {
        hostname = email.split("@")[1];
    }
    return hostname;
};


export let extractRootDomain = (url: string) => {
    let domain = extractHostname(url);
    const splitArr = domain.split("."),
        arrLen = splitArr.length;

    // extracting the root domain here
    // if there is a subdomain
    if (arrLen > 2) {
        domain = splitArr[arrLen - 2] + "." + splitArr[arrLen - 1];
        // check to see if it"s using a Country Code Top Level Domain (ccTLD) (i.e. ".me.uk")
        if (splitArr[arrLen - 1].length == 2 && splitArr[arrLen - 1].length == 2) {
            // this is using a ccTLD
            domain = splitArr[arrLen - 3] + "." + domain;
        }
    }
    return domain;
};

export let uploadImage = (user: any, newImage: ImageModel, original_name: string, imgType: string, done: Function) => {
    // logger.debug("////////////////newImage", newImage, original_name, imgType );
    if(!newImage) {
        done(undefined, undefined);
    } else {
        cloudinary.v2.uploader.upload(newImage.img_path, (error:any , result:any) => {
            if(error) {
                logger.error("Clodinary upload error",error);
                done(error);
            } else {
                // logger.debug("Clodinary uploaded",result);
                newImage.filename = result.public_id;
                if(original_name) {
                    newImage.original_name= original_name;
                } else {
                    newImage.original_name = result.original_filename;
                }
                newImage.width = result.width;
                newImage.height = result.height;
                newImage.mime_type = result.format;
                newImage.bytes = result.bytes;
                newImage.version = result.version;
                newImage.etag = result.etag;
                newImage.img_path = result.secure_url.slice(0, result.secure_url.lastIndexOf('v'+result.version)) + 'q_auto/' + result.public_id + '.' + result.format;
                newImage.thumbnail_path = result.secure_url.slice(0, result.secure_url.lastIndexOf('v'+result.version)) + 'h_75,w_75,c_fit/' + result.public_id + '.' + result.format;
                newImage.store = ImgStore.find((element) => element == "cloudinary");
                if(user) newImage.by = user._id;
                newImage.for = ImgType.find((element) => element == imgType);
                // logger.debug("Clodinary uploaded",newImage);
                setTimeout(() => {
                    if(newImage.img_path.indexOf("http") == -1) {
                        fs.unlink(newImage.img_path, (err) => {
                            if (err) throw err;
                            logger.debug(newImage.img_path +' was deleted');
                        });
                    }
                    // cloudinary.v2.uploader.destroy(result.public_id, (error:any , res:any) => {
                    //     logger.debug("Clodinary Deleted",result.public_id, res)
                    // });
                }, 5*60*1000);
                done(undefined, newImage);
            }
        });
    }
};

export let saveImage = (newImage: ImageModel, done: Function) => {
    if(!newImage) {
        done(undefined, undefined);
    } else {
        (new Image(newImage)).save((err: Error, savedImage: ImageModel) => {
            if(err) {
                logger.error("error on saving image",err);
                done(err);
            } else {
                logger.debug("savedImage", savedImage?savedImage.toString():savedImage);
                done(undefined, savedImage);
            }
        });
    }
};
export let updateUserProfilePic = (user: any, projection: string,  savedImage: ImageModel, done: Function) => {
    const userWithPic = {
        _id: user._id,
        pic: {
            img_id: savedImage._id,
            img_store: savedImage.store,
            thumbnail: savedImage.thumbnail_path,
            img_path: savedImage.img_path
        }
    }; 
    let query: any = { "_id" : user._id };
    User.findOneAndUpdate(query, userWithPic, {select: projection, new: true}, ( err: Error, userFromDb: UserModel ) => {
        if ( err ) {
            logger.error("error on saving user",err);
            done(err);
        } else if ( !userFromDb ) {
            logger.debug("No user found Error",);
            done(true);
        } else {
            logger.debug("userFromDb", userFromDb?userFromDb.toString():userFromDb);
            done(undefined, {img: savedImage, user: userFromDb});
        }
    });
};

export let createProfile = (newUser: UserModel, existingSite: SiteModel, savedImage: ImageModel, done: Function) => {
    let mobileOTP: number;
    let emailOTP: number;
    if(newUser.login.email && newUser.login.email_verified){
        emailOTP = createRandomOTP();
    }
    if(newUser.login.mobile && newUser.login.mobile_verified){
        mobileOTP = createRandomOTP(); 
    }
    if(newUser.profile && newUser.profile.positions) logger.debug("socialUser positions ", newUser.profile.positions.toString());
    newUser.logs = {
        signup:  new Date(),
        last_login: new Date(),
        last_active: new Date(),
        online: true,
        available: true,
        status: ApplicationStatus.find((element) => element == "Pending"),
        status_update: new Date()
    };
    if(savedImage){ 
        newUser.pic = {
            img_id: savedImage._id,
            img_store: savedImage.store,
            thumbnail: savedImage.thumbnail_path,
            img_path: savedImage.img_path
        };
    }
    newUser.site = existingSite._id;
    newUser.login.role = Roles.find((element) => element == "User");
    newUser.logs.completion_score= getProfileCompletionScore(newUser);
    if(mobileOTP){
        newUser.login.mobile_otp_expires = new Date( Date.now() + 1800 * 1000 ); //30 mins
        newUser.login.mobile_otp = mobileOTP+"";
    }
    if(emailOTP){
        newUser.login.email_token_expires = new Date( Date.now() + 1800 * 1000 ); //30 mins
        newUser.login.email_token = emailOTP+"";
    }
    logger.debug("createProfile new User", JSON.stringify(newUser));
    if(newUser.pass.password) {
        User.addUser(new User(newUser),false, (err: Error, savedUser: UserModel) => {
            if ( err ) {
                logger.error("error in adding user: ", err);
                done(err);
            } else {
                done(undefined, savedUser);
            }
        });
    } else {
        new User(newUser).save((err: Error, savedUser: UserModel) => {
            if ( err ) {
                logger.error("error in adding user: ", err);
                done(err);
            } else {
                done(undefined, savedUser);
            }
        });
    }

};
export let getProfileCompletionScore = (existingUser: UserModel) => {
    return 1;
};
//db.users.deleteOne({_id: "5ac743ff77d5cf5922b2433e"})
export let updateProfile = (newUser: UserModel, existingUser: UserModel, overwrite: boolean,  savedImage: ImageModel, done: Function) => {
    let mobileOTP: number;
    let emailOTP: number;
    if(newUser.login.email && !newUser.login.email_verified){
        emailOTP = createRandomOTP();
    }
    if(newUser.login.mobile && !newUser.login.mobile_verified){
        mobileOTP = createRandomOTP(); 
    }
    if(newUser.profile && newUser.profile.positions) logger.debug("socialUser positions ",newUser.profile.positions);
    if(overwrite){
        if(existingUser.profile && !newUser.profile) newUser.profile = {}; 
        newUser.login.role = existingUser.login.role;
        newUser.logs = {
            signup:  new Date(),
            last_login: new Date(),
            last_active: new Date(),
            online: true,
            available: true,
            status: ApplicationStatus.find((element) => element == "Pending"),
            status_update: new Date()
        }  ;
    } else {
        let sign= existingUser.sign;
        if(!existingUser.sign.title && newUser.sign.title) sign.title = newUser.sign.title;
        newUser.sign = sign;
        newUser.logs= existingUser.logs;
        newUser.logs.last_login = new Date();
        newUser.logs.last_active = new Date();
        newUser.logs.online = true;
        newUser.logs.available = true;
        if(existingUser.profile){
            let profile:any = existingUser.profile;
            if((!existingUser.profile.positions || existingUser.profile.positions.length < 1) && newUser.profile && newUser.profile.positions){
                profile.positions = newUser.profile.positions;
            }
            if(newUser.profile){
                if(!existingUser.profile.intro) profile.intro = {};
                if(newUser.profile.intro && newUser.profile.intro.linkedin) profile.intro.linkedin = newUser.profile.intro.linkedin;
                if(newUser.profile.intro && newUser.profile.intro.facebook) profile.intro.facebook = newUser.profile.intro.facebook;
                if(!existingUser.profile.gender && newUser.profile.gender) profile.gender = newUser.profile.gender;
                if(!existingUser.profile.industry && newUser.profile.industry) profile.industry = newUser.profile.industry;  
                if(!existingUser.profile.location) profile.location = newUser.profile.location; 
            } 
            newUser.profile = profile;
        }
        let login = existingUser.login;
        // logger.debug("login", existingUser.login.role, login);
        if(newUser.login.linkedin) login.linkedin = newUser.login.linkedin;
        if(newUser.login.facebook) login.facebook = newUser.login.facebook;
        if(newUser.login.google) login.google = newUser.login.google;
        let tokens: any[];
        if(existingUser.login.tokens) { 
            tokens=existingUser.login.tokens;
        } else {
            tokens=[];
        }
        if(newUser.login.tokens) {
            newUser.login.tokens.forEach((token) => {
                let replaceIndex = -1;
                tokens.forEach((oldToken, index) => {
                    if(oldToken.kind == token.kind && oldToken.provider == token.provider) {
                        replaceIndex = index;
                    }
                });
                if(replaceIndex != -1 ){
                    tokens[replaceIndex] = token; 
                } else {
                    tokens.push(token);
                }
            });
        }
        login.tokens = tokens;
        // logger.debug("login.tokens", login.tokens);
        newUser.login = login;
    }
    // logger.debug("////////////existingUser.pic", !existingUser.pic, existingUser.pic)
    if(savedImage && (!existingUser.pic || !existingUser.pic.img_id || overwrite)){ 
        newUser.pic = {
            img_id: savedImage._id,
            img_store: savedImage.store,
            thumbnail: savedImage.thumbnail_path,
            img_path: savedImage.img_path
        };
    } else if(existingUser.pic && !newUser.pic){
        newUser.pic = existingUser.pic;
    } else {
        newUser.pic = {};
    }
    newUser._id= existingUser._id;
    newUser.logs.completion_score= getProfileCompletionScore(newUser);
    if(mobileOTP){
        newUser.login.mobile_otp_expires = new Date( Date.now() + 3600 * 1000 ); //60 mins
        newUser.login.mobile_otp = mobileOTP+"";
    }
    if(emailOTP){
        newUser.login.email_token_expires = new Date( Date.now() + 3600 * 1000 ); //60 mins
        newUser.login.email_token = emailOTP+"";
    }
    // newUser.login.role = Roles.find((element) => element == "User");
    logger.debug("new existingUser", overwrite, newUser?newUser.toString():newUser);

    User.addUser(newUser, true, (err: Error, savedUser: UserModel) => {
        if ( err ) {
            logger.error("error in updating user: ", err);
            done(err);
        } else {
            logger.debug("updated existingUser", savedUser? savedUser.toString(): savedUser);
            done(undefined, savedUser);
        }
    });

};
export let updateUserForSignIn = (existingUser: UserModel, updateJson: any, done: Function) => {
    let userUpdateJson: any =  {};
    // userUpdateJson._id= existingUser._id;
    // userUpdateJson.logs= existingUser.logs;
    userUpdateJson["logs.last_login"] = new Date();
    userUpdateJson["logs.last_active"] = new Date();
    userUpdateJson["logs.online"] = true;
    userUpdateJson["logs.available"] = true;
    if(updateJson){
        if(updateJson["login.email_verified"]){
            userUpdateJson["login.email_verified"] = true;
        } 
        if(updateJson["login.mobile_verified"]){
            userUpdateJson["login.mobile_verified"] = true;
        }
    }
    
    User.findByIdAndUpdate(existingUser._id, userUpdateJson, {select: "site login sign profile pic programs logs", new: true}, (err: Error, savedUser: UserModel) => {
        if ( err ) {
            logger.error("error in adding user: ", err);
            done(err);
        } else {
            logger.debug("User Signed in", convertUsertoString(savedUser));
            // logger.debug("updated existingUser", savedUser);
            // MailService.sendVerifyMail(savedUser);
            done(undefined, savedUser);
        }
    });
};