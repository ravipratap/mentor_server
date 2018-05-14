
import { default as Program, ProgramModel } from "../models/program-model";
import { Roles, ApplicationStatus } from "../models/user-model";
import { ImageModel } from "../models/image-model";
import { default as User, UserModel } from "../models/user-model";
import Site, { SiteModel } from "../models/site-model";
import Survey, { SurveyModel, UserSurveyModel, SurveyCategory } from "../models/survey-model";
import { SurveyResponseModel, UserBriefModel } from "../models/shared-model";
import * as MailService from "./mailService";
import * as SmsService from "./smsService";
import { convertUsertoString } from "./utilities";
const logger = require("../config/logger").logger;


export let updateProgram = (user: any, program: ProgramModel, defaultChanged: boolean, savedImage: ImageModel, done: Function) => {
    if(!program.site || user.role != Roles.find((element) => element == "SuperAdmin")) {
        program.site = user.site;
    }
    if(savedImage) {
        program.profile.img_id = savedImage._id;
        program.profile.img_store = savedImage.store;
        program.profile.thumbnail = savedImage.thumbnail_path;
        program.profile.img_path = savedImage.img_path;
    }
    if(program._id){
        const query: any = { "_id" : program._id };
        if(user.role == Roles.find((element) => element == "ProgramAdmin")) {
            query["program_admins.id"] = user._id;
        }
        // logger.debug("query: ", query);
        Program.findOneAndUpdate(query, program, {select: "site profile", new: true}, (err: Error, savedProgram: ProgramModel) => {
            if ( err ) {
                logger.error("error in saving program: " + err);
                done(err);
            } else {
                logger.debug("program: ", savedProgram?savedProgram.toString():savedProgram);
                if(defaultChanged && !program.profile.is_default){
                    Site.findByIdAndUpdate(program.site, { $pull: {
                        'signup_pre': {
                            "program": savedProgram._id
                        }, 
                        'signup_post': {
                            "program": savedProgram._id
                        }
                    }},  { select: "profile config signup_pre signup_post", new: true }, (errata: Error, savedSite: SiteModel) => {
                        if ( errata ) {
                            logger.error("error in removing signup surveys for program: ", errata);
                        }
                        logger.debug("site saved after removing signup surveys", savedSite? savedSite.toString(): undefined);
                        done(undefined, savedProgram);
                    });
                } else  if(defaultChanged && program.profile.is_default) {
                    Survey.find({
                        $and: [
                            { "profile.program": savedProgram._id },
                            { $or: [{"profile.category": SurveyCategory.find((element) => element == "Signup")}, {"profile.category": SurveyCategory.find((element) => element == "PostSignup")}] }
                        ]
                    }, "profile" , (errata: Error, existingSurveys: SurveyModel[]) => {
                        if ( errata ) {
                            logger.error("error in adding signup surveys for program: ", errata);
                        }
                        if(existingSurveys && existingSurveys.length > 0){
                            let updateJson:any={};
                            logger.debug("existing surveys found for the program", existingSurveys? existingSurveys.toString(): undefined);
                            existingSurveys.forEach(existingSurvey => {
                                if(existingSurvey.profile.category == SurveyCategory.find( (element) => element == "Signup")){
                                    updateJson["signup_pre"] = { survey: existingSurvey._id, program: savedProgram._id };
                                } else {
                                    updateJson["signup_post"] = { survey: existingSurvey._id, program: savedProgram._id };
                                }
                                logger.debug("updateJson", JSON.stringify(updateJson));
                            });
                            Site.findByIdAndUpdate(savedProgram.site, { $addToSet: updateJson },  { select: "profile config signup_pre signup_post", new: true }, (errata2: Error, savedSite: SiteModel) => {
                                if ( errata2 ) {
                                    logger.error("error in saving site config for survey: ", errata2);
                                }
                                logger.debug("site saved after adding  survey", savedSite? savedSite.toString(): undefined);
                                 
                                logger.debug("site saved after adding signup surveys", savedSite? savedSite.toString(): undefined);
                                done(undefined, savedProgram); 
                            });
                        } else{   
                            logger.debug("existing surveys not found for the program", existingSurveys? existingSurveys.toString(): undefined);
                            done(undefined, savedProgram);
                        }
                    });
                } else {
                    done(undefined, savedProgram);
                }
            }
        });
    } else {
        if(user.role == Roles.find((element) => element == "ProgramAdmin")) {
            done({ status: "401"}); 
        } else {
            new Program(program).save((err: Error, savedProgram: ProgramModel) => {
                if ( err ) {
                    logger.error("error in saving program: " + err);
                    done(err);
                } else  {
                    logger.debug("program created: ",program?program.toString():program,  savedProgram?savedProgram.toString():savedProgram);
                    done(undefined, savedProgram);
                }
            });
        }
    }
};

export let getAdmins =  (userFromToken: any,  programId: string, siteId: string, done: Function) => {
    let query: any = {};
    logger.debug("programId and  siteId", programId, siteId);
    if(programId) {
         query["_id"] = programId;
         query["site"] = siteId;  
         Program.findOne(query, 'admins', (err: Error, existingProgram: ProgramModel) => {      
             if ( err ) {
                 logger.error("error in getting admins", err);
                 done(err);
             } else {
                 if(!existingProgram || (userFromToken.role == Roles.find((element) => element == "ProgramAdmin") && !existingProgram.admins.find(elem => elem.id == userFromToken._id))){
                    logger.error("Program Admin doesn't have permission for this program", programId, JSON.stringify(userFromToken));
                    done({ status: "401"}); 
                 }
                 logger.debug("got admins of program", existingProgram?existingProgram.toString():existingProgram);
                 done(undefined, existingProgram,  existingProgram.admins);
             }
         });
    } else {
        query["_id"] = siteId; 
        Site.findOne(query, 'admins', (err: Error, existingSite: SiteModel) => {      
            if ( err ) {
                logger.error("error in getting admins", err);
                done(err);
            } else {
                if(!existingSite ){
                    done({ status: "401"}); 
                 } else {
                    logger.debug("got admins of site", existingSite?existingSite.toString():existingSite);
                    done(undefined, undefined, existingSite.admins);
                 }
            }
        });
    }

};
export let fillAdminDetails =  (existingProgram: ProgramModel, admins: UserBriefModel[], done: Function) => {
    User.find({ _id: {$in : admins.map(a=>a.id)}},"sign login pic", (err: Error, users: [UserModel]) => {      
        if ( err ) {
            logger.error("error in getting admin details", err);
            done(err);
        } else {
            logger.debug("got admin Details", users?users.toString():users);
            done(undefined, users);
        }
    });
};

export let addUserDetails =  (siteId: string, emails: string[], mobiles: string[], existingProgram: ProgramModel, existingAdmins: UserBriefModel[], done: Function) => {
    User.find({ $or: [{"login.email": {$in : emails}}, {"login.mobile": {$in : emails}}, {"_id" : {$in: existingAdmins.map((a=>a.id))}}]},"sign login pic", (err: Error, allUsers: UserModel[]) => {      
        if ( err ) {
            logger.error("error in getting admin details", err);
            done(err);
        } else {
            let existingUsers: UserModel[] = allUsers.filter(user => (user.login.email && emails.indexOf(user.login.email) > -1) || (user.login.mobile && mobiles.indexOf(user.login.mobile) > -1));
            let existingFullAdmins: UserModel[] = allUsers.filter(user => existingAdmins.find(admin => user._id.equals(admin.id)))
            logger.debug("All Users", emails, mobiles, allUsers?allUsers.toString():allUsers);
            logger.debug("existingUsers", existingUsers?existingUsers.toString():existingUsers);
            logger.debug("existingFullAdmins", existingFullAdmins?existingFullAdmins.toString():existingFullAdmins);
            
            let setSiteAdminUsers: UserModel[];
            let setProgramAdminUsers: UserModel[];
            let setPossibleUsers: UserModel[];
            setPossibleUsers = existingFullAdmins.filter( userAdmin => existingUsers.find(user => user._id.equals(userAdmin._id)) == undefined);
            if(!existingProgram && existingUsers) {
                setSiteAdminUsers = existingUsers.filter(user => user.login.role != Roles.find((element) => element == "SiteAdmin"));
            } else if(existingProgram && existingUsers) {
                setProgramAdminUsers = existingUsers.filter(user => user.login.role == Roles.find((element) => element == "User"));
                setPossibleUsers = setPossibleUsers.filter( userAdmin => userAdmin.login.role != Roles.find((element) => element == "SiteAdmin"));
            }
            logger.debug("setSiteAdminUsers", setSiteAdminUsers?setSiteAdminUsers.toString():setSiteAdminUsers);

            if(allUsers && allUsers.length > 0) {
                allUsers.forEach( user => {
                    if(user.login.email) emails = emails.filter(e => e !== user.login.email);
                    if(user.login.mobile) mobiles = mobiles.filter(e => e !== user.login.mobile);
                });
            }

            if(emails.length > 0 || mobiles.length > 0){
                let newUsersDocs: any[]= [];
                let role = existingProgram? Roles.find((element) => element == "ProgramAdmin") :  Roles.find((element) => element == "SiteAdmin"); 
                emails.forEach(email => newUsersDocs.push({ login: { email: email, role : role}, site: siteId}));
                mobiles.forEach(mobile => newUsersDocs.push({ login: { mobile: mobile, role : role}, site: siteId}));
                User.create(newUsersDocs, (err: Error, newUsers: UserModel[]) => {
                    if ( err ) {
                        logger.error("error in getting admin details", err);
                        done(err);
                    } else {
                        logger.debug("newUsers", newUsers && newUsers.length > 0 ? newUsers.toString(): newUsers)
                        done(undefined, setPossibleUsers, setProgramAdminUsers, setSiteAdminUsers, newUsers, existingUsers, existingProgram);
                    }  
                });
            } else {
                done(undefined, setPossibleUsers, setProgramAdminUsers, setSiteAdminUsers, undefined, existingUsers, existingProgram);
            }
        }
    });
};
export let keepExistingProgramAdmins =  (siteId: string, setPossibleUsers: UserModel[], setProgramAdminUsers: UserModel[], setSiteAdminUsers: UserModel[], newUsers: UserModel[], existingUsers: UserModel[], existingProgram: ProgramModel, done: Function) => {
    let andQuery:any = [{site: siteId}, {"admins.id": {$in: setPossibleUsers.map(a => a._id)}}];
    if(existingProgram){
        andQuery.push( {_id: {$ne: existingProgram._id}} );
    }
    Program.find({$and: andQuery}, (err: Error, otherPrograms: ProgramModel[]) => {
        if ( err ) {
            logger.error("error in getting admin details", err);
            done(err);
        } else {
            if(otherPrograms && otherPrograms.length > 0){
                let keepAdminList: any[] =[]
                otherPrograms.forEach((otherProgram) => {
                    let keepAdmins = setPossibleUsers.filter( user => otherProgram.admins.find(admin=>user._id.equals(admin.id)) != undefined) 
                    keepAdmins = keepAdmins.filter( user => keepAdminList.find(admin => user._id.equals(admin.id)) == undefined);
                    keepAdminList= keepAdminList.concat(keepAdmins);    
                }); 
                // logger.debug("otherPrograms", otherPrograms?otherPrograms.toString() : otherPrograms);
                logger.debug("keep these users as Program Admins", keepAdminList? keepAdminList.toString(): keepAdminList)
                if(keepAdminList.length > 0){
                    setPossibleUsers  = setPossibleUsers.filter( user => keepAdminList.find(admin=>user._id.equals(admin.id)) == undefined);
                    let newProgramAdminUsers =  keepAdminList.filter( user => user.login.role == Roles.find((element) => element == "SiteAdmin"));
                    if(newProgramAdminUsers.length > 0 ) {
                        if(setProgramAdminUsers && setProgramAdminUsers.length > 0) {
                            newProgramAdminUsers = newProgramAdminUsers.filter( user => setProgramAdminUsers.find(admin => user._id.equals(admin.id)) == undefined);
                            setProgramAdminUsers = setProgramAdminUsers.concat(newProgramAdminUsers);
                        } else {
                            setProgramAdminUsers = newProgramAdminUsers;
                        }
                    }
                }
            }
            logger.debug("setUsers updated from other programs", setPossibleUsers? setPossibleUsers.toString(): setPossibleUsers)
            done(undefined, setPossibleUsers, setProgramAdminUsers, setSiteAdminUsers, newUsers, existingUsers, existingProgram);
        }  
    });
    
};
export let setSiteAdmins =  (setUsers: UserModel[], setProgramAdminUsers: UserModel[], setSiteAdminUsers: UserModel[], newUsers: UserModel[], existingUsers: UserModel[], existingProgram: ProgramModel, done: Function) => {
    
    if(setSiteAdminUsers && setSiteAdminUsers.length > 0){
        User.update({_id: {$in: setSiteAdminUsers.map(a => a._id)}}, {"login.role": Roles.find((element) => element == "SiteAdmin")},{multi: true}, (err: Error, newSiteAdminUsers: UserModel[]) => {
            if ( err ) {
                logger.error("error in setting site admin role", err);
                done(err);
            } else {
                logger.debug("newSiteAdminUsers done:", newSiteAdminUsers? newSiteAdminUsers.toString(): newSiteAdminUsers)
                done(undefined, setUsers, setProgramAdminUsers, newSiteAdminUsers, newUsers, existingUsers, existingProgram);
            }  
        });
    } else {
        done(undefined, setUsers, setProgramAdminUsers, setSiteAdminUsers, newUsers, existingUsers, existingProgram);
    }
};

export let setProgramAdmins =  (setUsers: UserModel[], setProgramAdminUsers: UserModel[], setSiteAdminUsers: UserModel[], newUsers: UserModel[], existingUsers: UserModel[], existingProgram: ProgramModel, done: Function) => {
    if(setProgramAdminUsers && setProgramAdminUsers.length > 0){
        User.update({_id: {$in: setProgramAdminUsers.map(a => a._id)}}, {"login.role": Roles.find((element) => element == "ProgramAdmin")},{multi: true}, (err: Error, raw: any) => {
            if ( err ) {
                logger.error("error in setting programs admin role", err);
                done(err);
            } else {
                logger.debug("setProgramAdmins done:", raw)
                done(undefined, setUsers, setProgramAdminUsers, setSiteAdminUsers, newUsers, existingUsers, existingProgram);
            }  
        });
    } else {
        done(undefined, setUsers, setProgramAdminUsers, setSiteAdminUsers, newUsers, existingUsers, existingProgram);
    }
};

export let resetAsUsers =  (setUsers: UserModel[], setProgramAdminUsers: UserModel[], setSiteAdminUsers: UserModel[], newUsers: UserModel[], existingUsers: UserModel[], existingProgram: ProgramModel, done: Function) => {
    if(setUsers && setUsers.length > 0){
        User.update({_id: {$in: setUsers.map(a => a._id)}}, {"login.role": Roles.find((element) => element == "User")},{multi: true}, (err: Error, raw: any) => {
            if ( err ) {
                logger.error("error in setting programs admin role", err);
                done(err);
            } else {
                logger.debug("resetAsUsers ", raw)
                done(undefined, setUsers, setProgramAdminUsers, setSiteAdminUsers, newUsers, existingUsers, existingProgram);
            }  
        });
    } else {
        done(undefined, setUsers, setProgramAdminUsers, setSiteAdminUsers, newUsers, existingUsers, existingProgram);
    }
};

export let setAllAdmins =  (siteId: string, setUsers: UserModel[], setProgramAdminUsers: UserModel[], setSiteAdminUsers: UserModel[], newUsers: UserModel[], existingUsers: UserModel[], existingProgram: ProgramModel, done: Function) => {
    let allAdmins: UserBriefModel[] = [];
    let admins: UserModel[] = [];
    if(existingUsers && existingUsers.length > 0) {
        existingUsers.forEach((user) => {
            admins.push(user);
            allAdmins.push(<UserBriefModel>{
                id: user._id,
                sign: (user.sign || user.pic)?{
                    first: user.sign? user.sign.first: undefined,
                    thumbnail: user.pic?user.pic.thumbnail: undefined,
                    img_store: user.pic?user.pic.img_store: undefined 
                } : undefined
            });
        });
    }
    if(newUsers && newUsers.length > 0) {
        newUsers.forEach((user) => {
            admins.push(user);
            allAdmins.push(<UserBriefModel>{
                id: user._id
            });
        });
    }
    if(existingProgram){
        Program.findByIdAndUpdate(existingProgram._id,{ admins: allAdmins }, (err: Error, savedProgram: ProgramModel) => {
            if ( err ) {
                logger.error("error in setting programs admin role", err);
                done(err);
            } else {
                MailService.notifyAdminsByMail(admins, undefined, setUsers, setProgramAdminUsers, setSiteAdminUsers, newUsers, existingUsers, savedProgram);
                SmsService.notifyAdminsByMail(admins, undefined, setUsers, setProgramAdminUsers, setSiteAdminUsers, newUsers, existingUsers, savedProgram);
                done(undefined, admins);
            } 
        });
    } else {
        Site.findByIdAndUpdate(siteId,{ admins: allAdmins }, (err: Error, savedSite: SiteModel) => {
            if ( err ) {
                logger.error("error in setting programs admin role", err);
                done(err);
            } else {
                MailService.notifyAdminsByMail(admins, savedSite, setUsers, setProgramAdminUsers, setSiteAdminUsers, newUsers, existingUsers, existingProgram);
                SmsService.notifyAdminsByMail(admins, savedSite, setUsers, setProgramAdminUsers, setSiteAdminUsers, newUsers, existingUsers, existingProgram);
                done(undefined, admins);
            } 
        });
    }
};



