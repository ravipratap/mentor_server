
import { default as Program, ProgramModel } from "../models/program-model";
import { Roles, ApplicationStatus } from "../models/user-model";
import { ImageModel } from "../models/image-model";
import { default as User, UserModel } from "../models/user-model";
import Site, { SiteModel } from "../models/site-model";
import Survey, { SurveyModel, UserSurveyModel } from "../models/survey-model";
import { SurveyResponseModel, UserBriefModel } from "../models/shared-model";
import * as MailService from "./mailService";
import * as SmsService from "./smsService";
const logger = require("../config/logger").logger;
export let updateProgram = (user: any, program: ProgramModel, savedImage: ImageModel, done: Function) => {
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
                done(undefined, savedProgram);
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
export let populateSignUpForm =  ( preSignup: boolean, existingSite: SiteModel, specificSurveyId: string, savedUser: UserModel, done: Function) => {
    
    let siteDefaultQuestionsNeeded = ((preSignup && existingSite && existingSite.config.signup_pre) || (!preSignup && existingSite && existingSite.config.signup_post))?true: false;
    let surveyId: string;
    let surveyResponse: SurveyResponseModel;
    let is_mentor = false;
    let userProgramId: string;
    if(specificSurveyId) surveyId =specificSurveyId;
    if(savedUser.programs && savedUser.programs.length > 0) {
        savedUser.programs.forEach( (programData) => {
            if(surveyId) {
                if(programData.signup_pre && programData.signup_pre.survey == specificSurveyId) surveyResponse = programData.signup_pre;
                if(programData.signup_post && programData.signup_post.survey == specificSurveyId) surveyResponse = programData.signup_post;
            } else {
                if(preSignup && existingSite && programData.signup_pre && programData.signup_pre.answered  && programData.signup_pre.survey == existingSite.config.signup_pre){
                    siteDefaultQuestionsNeeded = false;
                }
                if(!preSignup && existingSite && programData.signup_post && programData.signup_post.answered  && programData.signup_post.survey == existingSite.config.signup_post){
                    siteDefaultQuestionsNeeded = false;
                }
                if((preSignup && programData.signup_pre && !programData.signup_pre.answered) || (!preSignup && programData.signup_post && !programData.signup_post.answered)){
                    surveyId = preSignup?programData.signup_pre.survey: programData.signup_post.survey;
                    surveyResponse = preSignup?programData.signup_pre: programData.signup_post; 
                    is_mentor = programData.is_mentor;
                    userProgramId = (programData as any)._id;
                    logger.debug("programData", programData.toString(), "userProgramId", userProgramId.toString());
                }
            }
        });
    }

    if(!specificSurveyId && existingSite && siteDefaultQuestionsNeeded){
        surveyId = preSignup?existingSite.config.signup_pre: existingSite.config.signup_post;
    }
    const result : any = {user: savedUser, survey: undefined};
    if(!surveyId){
        if(!savedUser.login.email_verified && savedUser.login.email_token && savedUser.login.email_token_expires > new Date()) {
            result.emailVerify = true;
            MailService.sendVerifyMail(savedUser);
        }
        if(!savedUser.login.mobile_verified && savedUser.login.mobile_otp && savedUser.login.mobile_otp_expires > new Date()) {
            result.mobileVerify = true;
            SmsService.sendVerifySms(savedUser);
        }
        done(undefined, result );
    } else {
        Survey.findById(surveyId, "profile questions", (err: Error, survey: SurveyModel) => {
            if ( err ) {
                logger.error("error in retreiving programs: ", err);
                done(err);
            } else {
                logger.debug("surveyId", surveyId?surveyId.toString():surveyId);
                let newSurveyResponse:any;
                let newSurvey:UserSurveyModel; 
                if(survey) {
                    newSurveyResponse = populateAnswersForSignUpForm(savedUser, surveyResponse, survey, is_mentor);
                    newSurvey= <UserSurveyModel>JSON.parse(JSON.stringify(survey));
                    newSurvey.questions.sort((a, b) => a.order - b.order);
                    if(userProgramId) {
                        newSurvey.userProgramId = userProgramId;
                        logger.debug("Updated survey userProgramId", newSurvey.userProgramId.toString(), userProgramId.toString());
                    }
                    logger.debug("survey found for response: ", JSON.stringify(newSurvey));
                }
                done(undefined, {user: savedUser, survey: newSurvey, surveyResponse: newSurveyResponse});
            }
        });    
    }


};
export let populateAnswersForSignUpForm = (savedUser: UserModel, surveyResponse: SurveyResponseModel, survey: SurveyModel, is_mentor?: boolean) => {
    if(surveyResponse) surveyResponse.answers.sort((a, b) => a.order - b.order);
    let newSurveyResponse = surveyResponse?JSON.parse(JSON.stringify(surveyResponse)) : undefined;
    if(!newSurveyResponse){
        newSurveyResponse=<SurveyResponseModel>{
            survey: survey._id,
            answered: false,
            answers: []
        };
    }
    survey.questions.forEach( (question, questionIndex) => {
        let answer:any = newSurveyResponse.answers.find((element:any) => element.qid == (question as any)._id);
        logger.debug("answers  exists?:", JSON.stringify(answer));
        if(!answer){
            answer = {};
            answer.qid= (question as any)._id;
            answer.order= questionIndex;
            answer.question = is_mentor && question.mentor_question? question.mentor_question : question.question;
            answer.category =question.category;
        }
        switch(question.category){
            case "Photo": {
                if(savedUser.pic){
                    answer.answer = {
                        img_path: savedUser.pic.img_path,
                        img_store: savedUser.pic.img_store 
                    };
                }
                break;
            }
            case "Gender": {
                if(savedUser.profile.gender) answer.answer = savedUser.profile.gender;
                break;
            }
            case "Current Location": {
                // logger.debug("savedUser.profile.location", savedUser.profile.location.toString());
                if(savedUser.profile.location && savedUser.profile.location.name) answer.answer = savedUser.profile.location.name + ", " + savedUser.profile.location.country.name;
                break;
            }
            case "Age": {
                if(savedUser.profile.age) answer.answer = savedUser.profile.age;
                break;
            }
            case "ExpInYrs": {
                if(savedUser.profile.expInYrs) answer.answer = savedUser.profile.expInYrs;
                break;
            }
            case "Job Level": {
                if(savedUser.profile.level) answer.answer = savedUser.profile.level;
                break;
            }
            case "Function": {
                if(savedUser.profile.function && savedUser.profile.function.length > 0) answer.answer = savedUser.profile.function;
                break;
            }
            case "Industry": {
                if(savedUser.profile.industry && savedUser.profile.industry.length > 0) answer.answer = savedUser.profile.industry;
                break;
            }
            case "Skills": {
                if(savedUser.profile.skills && savedUser.profile.skills.length > 0) answer.answer = savedUser.profile.skills;
                break;
            }
        }
        if(questionIndex < newSurveyResponse.answers.length) {
            newSurveyResponse.answers[questionIndex] = answer; 
        } else {
            newSurveyResponse.answers.push(answer);
        }
    });
    return newSurveyResponse;
};
export let populateUserFromSignUpForm = (preSignup: boolean, is_mentor:boolean, userProgramId: string, programId: string, userFromToken: any, surveyResponse: SurveyResponseModel, savedImage: ImageModel, done: Function) => {
    if(surveyResponse) {
        let updateJson: any = {};
        let pushJson: any  = {};
        let searchQuery: any; 
        if(savedImage) {
            updateJson.pic = {
                img_id: savedImage._id,
                img_store: savedImage.store,
                thumbnail: savedImage.thumbnail_path,
                img_path: savedImage.img_path
            };
        }
        surveyResponse.answers.forEach((answer, answerIndex) => {
            logger.debug("answer: ", answer);
            if(answer.answer){
                switch(answer.category){
                    case "Gender": {
                        updateJson["profile.gender"] = answer.answer;
                        break;
                    }
                    case "Current Location": {
                        updateJson["profile.location.name"] = answer.answer.substr(0,answer.answer.lastIndexOf(','));
                        updateJson["profile.location.country.name"] = answer.answer.substr(answer.answer.lastIndexOf(',') + 2);
                        break;
                    }
                    case "Age": {
                        updateJson["profile.age"] = answer.answer;
                        break;
                    }
                    case "ExpInYrs": {
                        updateJson["profile.expInYrs"] = answer.answer;
                        break;
                    }
                    case "Job Level": {
                        updateJson["profile.level"] = answer.answer;
                        break;
                    }
                    case "Function": {
                        updateJson["profile.function"] = answer.answer;
                        break;
                    }
                    case "Industry": {
                        updateJson["profile.industry"] = answer.answer;
                        break;
                    }
                    case "Skills": {
                        updateJson["profile.skills"] = answer.answer;
                        break;
                    }
                }
            }
        });

        if(userProgramId){
            searchQuery = {_id: userFromToken._id, "programs._id" : userProgramId};
            updateJson["programs.$.is_mentor"] = is_mentor;
            if(preSignup){
                updateJson["programs.$.signup_pre"] = surveyResponse;
            } else {
                updateJson["programs.$.signup_post"] = surveyResponse;
            }

        } else {
            searchQuery = {_id: userFromToken._id};
            pushJson = { 
                programs: {
                    program: programId,
                    status: ApplicationStatus.find((element) => element == "Pending"),
                    is_mentor: is_mentor
                }
            };
            if(preSignup){
                pushJson.programs.signup_pre = surveyResponse;
            } else {
                pushJson.programs.signup_post = surveyResponse;
            }
        }
        // logger.debug("updateJson sign up form", updateJson);
        // logger.debug("pushJson sign up form", pushJson);
        let updatePushJson: any = {};
        if(updateJson && Object.keys(updateJson).length !== 0 ) updatePushJson.$set = updateJson;
        if(pushJson && Object.keys(pushJson).length !== 0 ) updatePushJson.$push = pushJson;
        logger.debug("updatePushJson sign up form", updatePushJson);
        User.findOneAndUpdate( searchQuery,
            updatePushJson,
            {select: "site login sign profile pic programs logs", new: true}, 
            (err: Error, savedUser: UserModel) => {      
                if ( err ) {
                    logger.error("error in updating user from form", err);
                    done(err);
                } else {
                    logger.debug("updated existingUser",userProgramId,  savedUser?savedUser.toString():savedUser);
                    done(undefined, savedUser);
                }
        });
        
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



