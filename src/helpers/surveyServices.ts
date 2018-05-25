import { default as User, UserModel, ApplicationStatus, ProfileAsSurveys, EditableSurveyData } from "../models/user-model";
import { SurveyResponseModel  } from "../models/shared-model";
import { ImageModel } from "../models/image-model";
import Survey, { SurveyModel, UserSurveyModel, SurveyCategory } from "../models/survey-model";
import { MarketplaceEntitlementService } from "aws-sdk";
import { SiteModel } from "../models/site-model";
import * as MailService from "./mailService";
import * as SmsService from "./smsService";
import { convertUsertoString } from "./utilities";
import  * as Authenticate  from "./authenticate";
import { returnStatement } from "babel-types";
const logger = require("../config/logger").logger;

export let populateSignUpForm =  ( preSignup: boolean, existingSite: SiteModel, specificSurveyId: string, savedUser: UserModel, done: Function) => {
    let defaultSurveys= JSON.parse(JSON.stringify(preSignup?existingSite.signup_pre: existingSite.signup_post));
    // let siteDefaultQuestionsNeeded = ((preSignup && existingSite && existingSite.signup_pre && existingSite.signup_pre.length > 0) || (!preSignup && existingSite && existingSite.signup_post && existingSite.signup_post.length > 0))?true: false;
    let surveyId: string;
    let surveyResponse: SurveyResponseModel;
    let is_mentor = false;
    let role: string;
    let userProgramId: string;
    let programId: string;
    if(specificSurveyId) surveyId = specificSurveyId;
    if(savedUser.programs && savedUser.programs.length > 0) {
        let fileteredProgramData: any;
        if(specificSurveyId) {
            fileteredProgramData = savedUser.programs.find(programData => (programData.signup_pre && programData.signup_pre.survey == specificSurveyId) || (programData.signup_post && programData.signup_post.survey == specificSurveyId));
            if(fileteredProgramData) preSignup= fileteredProgramData.signup_pre && fileteredProgramData.signup_pre.survey == specificSurveyId;
        } else {
            if(preSignup && existingSite.signup_pre  && existingSite.signup_pre.length > 0){
                fileteredProgramData = savedUser.programs.find(programData => programData.signup_pre && !programData.signup_pre.answered && existingSite.signup_pre.find( element => programData.signup_pre.survey.toString() == element.survey.toString()) != undefined);
            } else if(!preSignup && existingSite.signup_post  && existingSite.signup_post.length > 0){
                fileteredProgramData = savedUser.programs.find(programData => programData.signup_post && !programData.signup_post.answered && existingSite.signup_post.find( element => programData.signup_post.survey.toString() == element.survey.toString()) != undefined);
            }
            if(!fileteredProgramData){
                if(preSignup) fileteredProgramData = savedUser.programs.find(programData => programData.signup_pre && !programData.signup_pre.answered);
                if(!preSignup) fileteredProgramData = savedUser.programs.find(programData => programData.signup_post && !programData.signup_post.answered);
            }
            if(!fileteredProgramData){
                let surveyprogram: any;
                if( preSignup && existingSite.signup_pre && existingSite.signup_pre.length > 0 ) {
                    surveyprogram = existingSite.signup_pre.find(element => savedUser.programs.find( programData => programData.signup_pre.survey.toString() == element.survey.toString()) == undefined)
                } else if( !preSignup && existingSite.signup_post && existingSite.signup_post.length > 0 ) {
                    surveyprogram = existingSite.signup_post.find(element => savedUser.programs.find( programData => programData.signup_post.survey.toString() == element.survey.toString()) == undefined)
                }
                if(surveyprogram) {
                    surveyId= surveyprogram.survey;
                    let userprogramData= savedUser.programs.find(programData => programData.program.toString() == surveyprogram.program.toString());
                    if(userprogramData) {
                        is_mentor = userprogramData.is_mentor;
                        role = userprogramData.role;
                        userProgramId = (userprogramData as any)._id;
                        programId = userprogramData.program;
                    }
                }
                
            }
        }
        logger.debug("fileteredProgramData", fileteredProgramData?fileteredProgramData.toString():fileteredProgramData);
        if(fileteredProgramData){
            surveyId = preSignup?fileteredProgramData.signup_pre.survey: fileteredProgramData.signup_post.survey;
            surveyResponse = preSignup?fileteredProgramData.signup_pre: fileteredProgramData.signup_post; 
            is_mentor = fileteredProgramData.is_mentor;
            role = fileteredProgramData.role;
            userProgramId = fileteredProgramData._id; 
            programId = fileteredProgramData.program;
        }
        // savedUser.programs.forEach( (programData) => {
        //     if(specificSurveyId) {
        //         surveyId = specificSurveyId;
        //         if(programData.signup_pre && programData.signup_pre.survey == specificSurveyId) surveyResponse = programData.signup_pre;
        //         if(programData.signup_post && programData.signup_post.survey == specificSurveyId) surveyResponse = programData.signup_post;
        //         is_mentor = programData.is_mentor;
        //         userProgramId = (programData as any)._id;
        //         logger.debug("programData", programData.toString(), "userProgramId", userProgramId.toString());
        //     } else {
        //         if(defaultSurveys && defaultSurveys.length > 0){
        //             if(preSignup  && programData.signup_pre && !programData.signup_pre.answered  && existingSite.signup_pre.filter( element => programData.signup_pre.survey.toString() == element.survey.toString() )){
        //                 siteDefaultQuestionsNeeded = false;
        //             }
        //             if(!preSignup && programData.signup_post && programData.signup_post.answered  && programData.signup_post.survey == existingSite.config.signup_post){
        //                 siteDefaultQuestionsNeeded = false;
        //             }
        //         }
        //         if((preSignup && programData.signup_pre && !programData.signup_pre.answered) || (!preSignup && programData.signup_post && !programData.signup_post.answered)){
        //             surveyId = preSignup?programData.signup_pre.survey: programData.signup_post.survey;
        //             surveyResponse = preSignup?programData.signup_pre: programData.signup_post; 
        //             is_mentor = programData.is_mentor;
        //             userProgramId = (programData as any)._id;
        //             logger.debug("programData", programData.toString(), "userProgramId", userProgramId.toString());
        //         }
        //     }
        // });
    } else  if(!specificSurveyId) {
        if(preSignup && existingSite.signup_pre && existingSite.signup_pre.length > 0) surveyId = existingSite.signup_pre[0].survey;
        if(!preSignup && existingSite.signup_post && existingSite.signup_post.length > 0) surveyId = existingSite.signup_post[0].survey;
    }

    const result : any = {user: savedUser, survey: undefined};
    if(!surveyId){
        if(!savedUser.login.email_verified && savedUser.login.email_token && savedUser.login.email_token_expires > new Date()) {
            result.emailVerify = true;
            MailService.sendVerifyMail(savedUser, existingSite);
        }
        if(!savedUser.login.mobile_verified && savedUser.login.mobile_otp && savedUser.login.mobile_otp_expires > new Date()) {
            result.mobileVerify = true;
            SmsService.sendVerifySms(savedUser, existingSite);
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
                    newSurveyResponse = populateAnswersForSignUpForm(savedUser, surveyResponse, survey, is_mentor, role);
                    newSurvey= <UserSurveyModel>JSON.parse(JSON.stringify(survey));
                    newSurvey.questions.sort((a, b) => a.order - b.order);
                    if(userProgramId) {
                        newSurvey.userProgramId = userProgramId;
                        newSurvey.programId = programId;
                        logger.debug("Updated survey userProgramId", newSurvey.userProgramId.toString(), userProgramId.toString());
                    }
                    logger.debug("survey found for response: ", JSON.stringify(newSurvey));
                }
                done(undefined, {user: savedUser, survey: newSurvey, surveyResponse: newSurveyResponse});
            }
        });    
    }


};
let sortEducationAndExperience = (savedUser: UserModel) => {
    if(savedUser.profile.education && savedUser.profile.education.length > 0) {
        savedUser.profile.education.sort((a,b)=>{
            if(!b.startYear || !a.startYear){
                if(b.startYear){
                    return 1
                } else {
                    return -1;
                }
            } else if(b.startYear == a.startYear){
                if(b.endYear && a.endYear) {
                  return a.endYear - b.endYear;
                } else if(b.endYear){
                    return -1
                } else {
                    return 1;
                }
            } else {
                return a.startYear - b.startYear;
            }
        });
    }
    if(savedUser.profile.positions && savedUser.profile.positions.length > 0) {
        savedUser.profile.positions.sort((a,b)=>{
            if(!b.startDate || !a.startDate){
                if(b.startDate){
                    return 1
                } else {
                    return -1;
                }
            } else if(b.startDate.year == a.startDate.year && b.startDate.month == a.startDate.month){
                if(b.endDate && a.endDate) {           
                    if(b.endDate.year == a.endDate.year) {
                        return a.endDate.month - a.endDate.month
                    } else {
                        return a.endDate.year - a.endDate.year
                    }
                } else if(b.endDate){
                    return -1
                } else {
                    return 1;
                }
            } else {
                if(b.startDate.year == a.startDate.year) {
                    return a.startDate.month - a.startDate.month
                } else {
                    return a.startDate.year - a.startDate.year
                }
            }
        });
    }
};
export let populateAnswersForSignUpForm = (savedUser: UserModel, surveyResponse: SurveyResponseModel, survey: SurveyModel, is_mentor?: boolean, role?: string, indx?: number) => {
    if(surveyResponse) surveyResponse.answers.sort((a, b) => a.order - b.order);
    let newSurveyResponse = surveyResponse?JSON.parse(JSON.stringify(surveyResponse)) : undefined;
    if(!newSurveyResponse){
        newSurveyResponse=<SurveyResponseModel>{
            survey: survey._id,
            answered: false,
            answers: []
        };
    }
    let educationIndex = indx?indx:0;
    let positionIndex =  indx?indx:0;
    sortEducationAndExperience(savedUser);
    survey.questions.forEach( (question, questionIndex) => {
        let answer:any = newSurveyResponse.answers.find((element:any) => element.qid && element.qid == (question as any)._id);
        // logger.debug("answers  exists?:", JSON.stringify(answer), "category:", question.category);
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
            case "Sign": {
                if(savedUser.sign.first || savedUser.sign.last || savedUser.sign.title || (savedUser.profile && savedUser.profile.intro && savedUser.profile.intro.txt) ) {
                    answer.answer = {};
                    if(savedUser.sign.first) answer.answer.first = savedUser.sign.first;
                    if(savedUser.sign.last) answer.answer.last = savedUser.sign.last;
                    if(savedUser.sign.title) answer.answer.title = savedUser.sign.title;
                    if(savedUser.profile && savedUser.profile.intro && savedUser.profile.intro.txt) answer.answer.intro = savedUser.profile.intro.txt;
                }
                break;
            }
            case "Contact": {
                if(savedUser.login.email || savedUser.login.mobile) {
                    answer.answer = {};
                    if(savedUser.login.email) answer.answer.email = savedUser.login.email;
                    answer.answer.email_verified = savedUser.login.email_verified;
                    if(savedUser.login.mobile) answer.answer.mobile = savedUser.login.mobile;
                    answer.answer.mobile_verified = savedUser.login.mobile_verified;
                }
                break;
            }
            case "Background": {
                let tempAnswer: any;
                let tempIndex: number;
                if(savedUser.profile.positions && savedUser.profile.positions.length > 0){
                    if(positionIndex < savedUser.profile.positions.length) {
                        tempAnswer = {};
                        tempAnswer.is_student = false;
                        tempAnswer.company = savedUser.profile.positions[positionIndex].company.name;
                        tempAnswer.industry = savedUser.profile.positions[positionIndex].company.industry;
                        tempAnswer.designation = savedUser.profile.positions[positionIndex].title;
                        tempAnswer.aid = (savedUser.profile.positions[positionIndex] as any)._id.toString();
                        ++positionIndex;
                        tempIndex=positionIndex;
                    }
                } else {                    
                    if(educationIndex < savedUser.profile.education.length) {
                        tempAnswer = {};
                        tempAnswer.is_student = true;
                        tempAnswer.school = savedUser.profile.education[educationIndex].school.name;
                        tempAnswer.degree = savedUser.profile.education[educationIndex].degree;
                        if(savedUser.profile.education[educationIndex].fieldOfStudy) {
                            tempAnswer.degree = tempAnswer.degree + " - " + savedUser.profile.education[educationIndex].fieldOfStudy;
                        }
                        tempAnswer.startYear = savedUser.profile.education[educationIndex].startYear;
                        tempAnswer.aid = (savedUser.profile.education[educationIndex] as any)._id.toString();
                        ++educationIndex;
                        tempIndex = educationIndex;
                    }
                }
                if(tempAnswer){
                    if(tempIndex > 1){
                        let firstAns:any = newSurveyResponse.answers.find((element:any) => element.answer.aid && element.answer.aid.toString() == tempAnswer.aid.toString());
                        answer.answer = JSON.parse(JSON.stringify(firstAns.answer));
                        firstAns.answer= tempAnswer;
                    } else {
                        answer.answer = tempAnswer;
                    }
                }
                break;
            }
            case "Position": {
                if(positionIndex < savedUser.profile.positions.length) {
                    answer.answer = {};
                    answer.answer.company = savedUser.profile.positions[positionIndex].company.name;
                    answer.answer.industry = savedUser.profile.positions[positionIndex].company.industry;
                    answer.answer.designation = savedUser.profile.positions[positionIndex].title;
                    answer.answer.is_current = savedUser.profile.positions[positionIndex].is_current;
                    if(savedUser.profile.positions[positionIndex].startDate && savedUser.profile.positions[positionIndex].startDate.year) {
                        answer.answer.startDate = savedUser.profile.positions[positionIndex].startDate? (savedUser.profile.positions[positionIndex].startDate.year + (savedUser.profile.positions[positionIndex].startDate.month<10?"-0":"-")  + savedUser.profile.positions[positionIndex].startDate.month):undefined;

                    logger.debug("answer.answer.startDate", answer.answer.startDate, JSON.stringify(savedUser.profile.positions[positionIndex].startDate));
                    }
                    if(savedUser.profile.positions[positionIndex].endDate && savedUser.profile.positions[positionIndex].endDate.year){
                        answer.answer.endDate = savedUser.profile.positions[positionIndex].endDate? (savedUser.profile.positions[positionIndex].endDate.year + (savedUser.profile.positions[positionIndex].endDate.month <10?"-0":"-") + savedUser.profile.positions[positionIndex].endDate.month): undefined;
                    }
                    answer.answer.location= savedUser.profile.positions[positionIndex].location.name + ", " + savedUser.profile.positions[positionIndex].location.country.name;
                    answer.answer.aid = (savedUser.profile.positions[positionIndex] as any)._id.toString();
                    if(savedUser.profile.location && savedUser.profile.location.name) answer.answer.location = savedUser.profile.location.name + ", " + savedUser.profile.location.country.name;
                    ++positionIndex;
                }
                break;
            }
            case "Education": {                 
                if(educationIndex < savedUser.profile.education.length) {
                    answer.answer = {};
                    answer.answer.is_student = true;
                    answer.answer.school = savedUser.profile.education[educationIndex].school.name;
                    answer.answer.degree = savedUser.profile.education[educationIndex].degree;
                    if(savedUser.profile.education[educationIndex].fieldOfStudy) {
                        answer.answer.degree = answer.answer.degree + " - " + savedUser.profile.education[educationIndex].fieldOfStudy;
                    }
                    answer.answer.startYear = savedUser.profile.education[educationIndex].startYear;
                    answer.answer.endYear = savedUser.profile.education[educationIndex].endYear;
                    answer.answer.is_student = savedUser.profile.education[educationIndex].is_student;
                    answer.answer.aid = (savedUser.profile.education[educationIndex] as any)._id.toString();
                    ++educationIndex;
                }
                break;
            }
        }
        if(questionIndex < newSurveyResponse.answers.length) {
            newSurveyResponse.answers[questionIndex] = answer; 
        } else {
            newSurveyResponse.answers.push(answer);
        }
    });
    if(role) newSurveyResponse.role = role;
    if(is_mentor) newSurveyResponse.is_mentor = is_mentor; 
    return newSurveyResponse;
};
export let populateContactFromSignUpForm = (category: string, userFromToken: any, surveyResponse: SurveyResponseModel, savedImage: ImageModel, done: Function) => {
    let answers =surveyResponse.answers.filter(element => element.answer && element.category == "Contact");
    let answer = answers && answers.length>0? answers[0]: undefined;
    if(answer){
        let contact:any = {}
        let searchQuery:any = [{_id: userFromToken._id}]; 
        if(answer.answer.email) searchQuery.push({"login.email": answer.answer.email}); 
        if(answer.answer.mobile) searchQuery.push({"login.mobile": answer.answer.mobile});
        User.find({$or: searchQuery}, "site login sign profile pic programs logs", 
            (err: Error, users: UserModel[]) => {      
            if ( err) {
                logger.error("error in getting users", err);
                done(err);
            } else {
                let filteredUserList = users.filter(element => element._id.equals(userFromToken._id));
                if(!filteredUserList || filteredUserList.length != 1) return done("401");
                let user = filteredUserList[0];
                if(user.login.email != answer.answer.email){
                    if(user.login.email_verified && !user.login.mobile_verified){
                        return done({msg: "Please verify mobile before changing verified email"});
                    }
                    contact.email= answer.answer.email;
                }
                if(user.login.mobile != answer.answer.mobile){
                    if(!user.login.email_verified && user.login.mobile_verified){
                        return done({msg: "Please verify email before changing verified mobile"});
                    }
                    contact.mobile= answer.answer.mobile;
                }
                delete answer.answer;
                if(users.length == 1){
                    done(undefined, contact, category, userFromToken, surveyResponse, savedImage);
                } else {
                    let userForEmail: UserModel[];
                    let userForMobile: UserModel[];
                    if(contact.email)  userForEmail= users.filter(element => !element._id.equals(userFromToken._id) && element.login.email == contact.email);
                    if(contact.mobile)  userForMobile= users.filter(element => !element._id.equals(userFromToken._id) && element.login.mobile == contact.mobile);
                    if(userForEmail && userForEmail.length == 1){
                        if(userForEmail[0].login.email_verified) return done({msg: "Email is already used by another user"});
                        if(!userForEmail[0].login.email_verified) { // removing unverified email from other user
                            userForEmail[0].login.email = undefined;
                            if(!userForEmail[0].login.unverified) userForEmail[0].login.unverified = [];
                            userForEmail[0].login.unverified.push({
                                email: contact.email,
                                removed: Date.now(),
                                forUser: user._id
                            });
                            userForEmail[0].save((errata: Error, savedUser: UserModel) => {
                                logger.info("Unverified email removed from user", contact.email, convertUsertoString(savedUser));
                            });
                        }
                    }
                    if(userForMobile && userForMobile.length == 1){
                        if(userForMobile[0].login.mobile_verified) return done({msg: "Mobile is already used by another user"});
                        if(!userForMobile[0].login.mobile_verified) { // removing unverified mobile from other user
                            userForMobile[0].login.mobile = undefined;
                            if(!userForMobile[0].login.unverified) userForMobile[0].login.unverified = [];
                            userForMobile[0].login.unverified.push({
                                mobile: contact.mobile,
                                removed: Date.now(),
                                forUser: user._id
                            });
                            userForMobile[0].save((errata: Error, savedUser: UserModel) => {
                                logger.info("Unverified mobile removed from user", contact.mobile, convertUsertoString(savedUser));
                            });
                        }
                    }
                    done(undefined, contact, category, userFromToken, surveyResponse, savedImage);
                }
            }
        });

    } else {
        done(undefined, undefined, category, userFromToken, surveyResponse, savedImage)
    }
};
export let populateUserFromSignUpForm = (role:string, is_mentor:boolean, userProgramId: string, programId: string, contact:any, category: string, userFromToken: any, surveyResponse: SurveyResponseModel, savedImage: ImageModel, done: Function) => {
    if(surveyResponse) {
        let updateJson: any = {};
        let pushJson: any  = {};
        let searchQuery: any;
        let positions: any[] = [];
        let addPosition: boolean = true;
        let education: any[] = [];
        let addEducation: boolean = true;

        if(savedImage) {
            updateJson.pic = {
                img_id: savedImage._id,
                img_store: savedImage.store,
                thumbnail: savedImage.thumbnail_path,
                img_path: savedImage.img_path
            };
        }
        if(contact){
            if(contact.email) {
                updateJson["login.email"] = contact.email;
                updateJson["login.email_verified"] = false;
                let emailOTP = Authenticate.createRandomOTP();
                updateJson["login.email_token"] = emailOTP + "";
                updateJson["login.email_token_expires"] = new Date( Date.now() + 1800 * 1000 ); //30 mins
            }
            if(contact.mobile) {
                updateJson["login.mobile"] = contact.mobile;
                updateJson["login.mobile_verified"] = false;
                let mobileOTP = Authenticate.createRandomOTP();
                updateJson["login.mobile_otp"] = mobileOTP + "";
                updateJson["login.mobile_otp_expires"] = new Date( Date.now() + 1800 * 1000 ); //30 mins
            }
        }
        surveyResponse.answers.forEach((answer, answerIndex) => {
            // logger.debug("answer: ", answer);
            if(answer.answer){
                switch(answer.category){
                    case "Gender": {
                        updateJson["profile.gender"] = answer.answer;
                        delete answer.answer;
                        break;
                    }
                    case "Current Location": {
                        updateJson["profile.location.name"] = answer.answer.substr(0,answer.answer.lastIndexOf(','));
                        updateJson["profile.location.country.name"] = answer.answer.substr(answer.answer.lastIndexOf(',') + 2);
                        delete answer.answer;
                        break;
                    }
                    case "Age": {
                        updateJson["profile.age"] = answer.answer;
                        delete answer.answer;
                        break;
                    }
                    case "ExpInYrs": {
                        updateJson["profile.expInYrs"] = answer.answer;
                        delete answer.answer;
                        break;
                    }
                    case "Job Level": {
                        updateJson["profile.level"] = answer.answer;
                        delete answer.answer;
                        break;
                    }
                    case "Function": {
                        updateJson["profile.function"] = answer.answer;
                        delete answer.answer;
                        break;
                    }
                    case "Industry": {
                        updateJson["profile.industry"] = answer.answer;
                        delete answer.answer;
                        break;
                    }
                    case "Skills": {
                        updateJson["profile.skills"] = answer.answer;
                        delete answer.answer;
                        break;
                    }
                    case "Sign": {
                        if(answer.answer.first) updateJson["sign.first"] = answer.answer.first;
                        if(answer.answer.last) updateJson["sign.last"] = answer.answer.last;
                        if(answer.answer.title) updateJson["sign.title"] = answer.answer.title;
                        if(answer.answer.intro) updateJson["profile.intro.txt"] = answer.answer.intro;
                        delete answer.answer;
                        break;
                    }
                    case "Background": {
                        if(answer.answer.is_student){
                            let edu: any = {
                                school:  { name: answer.answer.school },
                                startYear: answer.answer.startYear
                            }
                            if(answer.answer.degree){
                                edu.degree= answer.answer.degree.substr(0,answer.answer.lastIndexOf('-') - 1);
                                edu.fieldOfStudy= answer.answer.degree.substr(0,answer.answer.lastIndexOf(',') + 2);
                            }
                            if(answer.answer.aid){
                                addEducation = false;
                                edu._id = answer.answer.aid; 
                            }
                            education.push(edu);
                        } else {
                            let position: any = {
                                company: {name: answer.answer.company, industry: answer.answer.industry },
                                title: answer.answer.designation
                            }
                            if(answer.answer.aid){
                                addPosition = false;
                                position._id = answer.answer.aid; 
                            }
                            positions.push(position);
                        }
                        delete answer.answer;
                        break;
                    }
                    case "Position": {
                        let position: any = {
                            company: {name: answer.answer.company, industry: answer.answer.industry },
                            title: answer.answer.designation,
                            is_current: answer.answer.is_current,
                            startDate: answer.answer.startDate,
                            endDate: answer.answer.endDate
                        }
                        if(answer.answer.location){
                            position.location = {
                                name: answer.answer.location.substr(0,answer.answer.location.lastIndexOf(',')),
                                country: {name: answer.answer.location.substr(answer.answer.location.lastIndexOf(',') + 2)}
                            };
                        }
                        if(answer.answer.startDate){
                            position.startDate = {
                                year: answer.answer.startDate.substr(0,answer.answer.startDate.lastIndexOf('-')),
                                month: answer.answer.startDate.substr(answer.answer.startDate.lastIndexOf('-') + 1)
                            };
                        }
                        if(answer.answer.endDate){
                            position.endDate = {
                                year: answer.answer.endDate.substr(0,answer.answer.endDate.lastIndexOf('-')),
                                month: answer.answer.endDate.substr(answer.answer.endDate.lastIndexOf('-') + 1)
                            };
                        }
                        if(answer.answer.aid){
                            addPosition = false;
                            position._id = answer.answer.aid; 
                        }
                        positions.push(position);
                        delete answer.answer;
                        break;
                    }
                    case "Education": {
                        let edu: any = {
                            school: { name: answer.answer.school },
                            startYear: answer.answer.startYear,
                            endYear: answer.answer.endYear,
                            is_student: answer.answer.is_student
                        }
                        if(answer.answer.degree){
                            edu.degree= answer.answer.degree.substr(0,answer.answer.degree.lastIndexOf('-') - 1);
                            edu.fieldOfStudy= answer.answer.degree.substr(answer.answer.degree.lastIndexOf('-') + 2);
                        }
                        if(answer.answer.aid){
                            addEducation = false;
                            edu._id = answer.answer.aid; 
                        }
                        education.push(edu);
                        delete answer.answer;
                        break;
                    }
                }
            }
        });
        if(category == SurveyCategory.find((element) => element == "Profile")){
            searchQuery = {_id: userFromToken._id}; 
        } else if(userProgramId){
            searchQuery = {_id: userFromToken._id, "programs._id" : userProgramId};
            updateJson["programs.$.is_mentor"] = is_mentor;
            if(role) updateJson["programs.$.role"] = role;
            if(category == SurveyCategory.find((element) => element == "Signup")){
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
            if(role) pushJson.programs.role = role;
            if(category == SurveyCategory.find((element) => element == "Signup")){
                pushJson.programs.signup_pre = surveyResponse;
            } else {
                pushJson.programs.signup_post = surveyResponse;
            }
        }
        if(addEducation && education.length == 1){
            pushJson["profile.education"] = education[0];
        } else if (!addEducation && education.length > 1){
            updateJson["profile.education"] = education;
        }
        if(addPosition && positions.length == 1){
            pushJson["profile.positions"] = positions[0];
        } else if (!addPosition && positions.length > 1){
            updateJson["profile.positions"] = positions;
        }
        // logger.debug("updateJson sign up form", updateJson);
        // logger.debug("pushJson sign up form", pushJson);
        let updatePushJson: any = {};
        if(updateJson && Object.keys(updateJson).length !== 0 ) updatePushJson.$set = updateJson;
        if(pushJson && Object.keys(pushJson).length !== 0 ) updatePushJson.$push = pushJson;
        logger.debug("updatePushJson sign up form", updatePushJson);
        // done("testing");
        // return;
        let edu:any;
        let position: any;
        if(!addEducation && education.length == 1) edu = education[0];
        if(!addPosition && positions.length ==1 ) position = positions[0];
        if(updatePushJson && Object.keys(updatePushJson).length !== 0) {
            User.findOneAndUpdate( searchQuery,
                updatePushJson,
                {select: "site login sign profile pic programs logs", new: true}, 
                (err: Error, savedUser: UserModel) => {      
                    if ( err ) {
                        logger.error("error in updating user from form", err);
                        done(err);
                    } else {
                        if(contact && contact.email && !savedUser.login.email_verified && savedUser.login.email_token && savedUser.login.email_token_expires > new Date()) {                            
                            MailService.sendVerifyMail(savedUser);
                        }
                        if(contact && contact.mobile && !savedUser.login.mobile_verified && savedUser.login.mobile_otp && savedUser.login.mobile_otp_expires > new Date()) {
                            SmsService.sendVerifySms(savedUser);
                        }
                        logger.debug("updated existingUser",userProgramId,  convertUsertoString(savedUser));
                        done(undefined, edu, position, savedUser);
                    }
            });
        } else {
            User.findById( searchQuery,
                "site login sign profile pic programs logs", 
                (err: Error, savedUser: UserModel) => {      
                    if ( err ) {
                        logger.error("error in updating user from form", err);
                        done(err);
                    } else {

                        logger.debug("existingUser for updation", edu, position,  convertUsertoString(savedUser));
                        done(undefined, edu, position,  savedUser);
                    }
            });
        }
        
    }  
};
export let updateEducationFromSignUpForm = (edu: any, position: any, user: UserModel, done: Function) => {
    if(!edu || Object.keys(edu).length == 0 ) {
        done(undefined, position, user);
    } else {
        logger.debug("existingUser for updationupdateEducationFromSignUpForm", edu, position, convertUsertoString(user));
        let searchQuery = {_id: user._id, "profile.education._id" : edu._id};
        let updatePushJson: any = {$set : {"profile.education.$": edu}};
        logger.debug("updateEducationFromSignUpForm", searchQuery, updatePushJson);
        User.findOneAndUpdate( searchQuery,
            updatePushJson,
            {select: "site login sign profile pic programs logs", new: true}, 
            (err: Error, savedUser: UserModel) => {      
                if ( err ) {
                    logger.error("error in updating user from form updateEducationFromSignUpForm", err);
                    done(err);
                } else {
                    logger.debug("updated updateEducationFromSignUpForm", convertUsertoString(savedUser));
                    done(undefined, position, savedUser);
                }
        });
    }
};
export let updatePositionFromSignUpForm = (position: any, user: UserModel, done: Function) => {
    if(!position || Object.keys(position).length == 0 ) {
        done(undefined, user);
    } else {
        let searchQuery = {_id: user._id, "profile.positions._id" : position._id};
        let updatePushJson: any = {$set : {"profile.positions.$": position}};
        User.findOneAndUpdate( searchQuery,
            updatePushJson,
            {select: "site login sign profile pic programs logs", new: true}, 
            (err: Error, savedUser: UserModel) => {      
                if ( err ) {
                    logger.error("error in updating user from form updateEducationFromSignUpForm", err);
                    done(err);
                } else {
                    logger.debug("updated updateEducationFromSignUpForm", convertUsertoString(savedUser));
                    done(undefined, savedUser);
                }
        });
    }
};

let getProfileFieldsAsSurvey = (user: UserModel, categories: string[], self:boolean, navTitle?: string, mandatory?: boolean[], indx?:number) : EditableSurveyData => {

    let survey = <SurveyModel>{
        profile : { 
            category: SurveyCategory.find((element) => element == "Profile"),
            // site: '5a93e3ece5787818ca40b00a',
            navTitle: navTitle ? navTitle : "Update profile",
        },
        questions: []
    }
    categories.forEach((category, index) => {
        let question: any = {
            order: index,
            category: category
        }
        if(mandatory && mandatory.length > 0 && mandatory[index]) question.mandatory = mandatory[index];
        switch(category){
            case "Gender":
            case "Current Location": 
            case "Age": 
            case "Industry": 
            case "Skills": {
                question.question= category;
                break;
            }
            case "Job Level":
            case "Function":  {
                question.question= category;
                question.other_choice = true;
                break;
            }
            case "ExpInYrs": {
                question.question= "Years of experience";
                break;
            }
            case "Position":
            case "Education":
            case "Contact":
            case "Sign": {
                question.question= " ";
                break;
            }
        }
        survey.questions.push(question);
    }); 
    survey.questions.sort((a, b) => a.order - b.order);
    const surveyResponse=populateAnswersForSignUpForm(user, undefined, survey, false, undefined,  indx);
    logger.debug("survey.questions ", survey.questions, "survey response", surveyResponse); 
    return <EditableSurveyData>{ survey: survey, surveyResponse: surveyResponse};

};

export let getProfileAsSurvey = (user: UserModel, surveys: SurveyModel[], self:boolean): ProfileAsSurveys => {
    logger.debug("user for edit", convertUsertoString(user));
    let personal_profile: EditableSurveyData;
    let intro = getProfileFieldsAsSurvey(user, ["Sign", "Current Location"], self, undefined, [true, false]);
    let contact = getProfileFieldsAsSurvey(user, ["Contact"], self, "Update contact", [true]);
    
    let profileAsSurveys: ProfileAsSurveys = {
        _id: user._id,
        site: user.site,
        pic: user.pic,
        logs: user.logs,
        intro: getProfileFieldsAsSurvey(user, ["Sign", "Current Location"], self, undefined, [true, false]),
    //     positions?:  EditableSurveyData,
    // education?: EditableSurveyData,
        personal_profile: getProfileFieldsAsSurvey(user, ["Age", "Gender", "ExpInYrs"], self),
        professional_profile: getProfileFieldsAsSurvey(user, ["Skills", "Function", "Job Level", "Industry"], self, "Update contact", [true])
    }
    if(self) profileAsSurveys.contact = getProfileFieldsAsSurvey(user, ["Contact"], self, "Update contact", [true]);
    if(user.profile.positions && user.profile.positions.length>0) {
        let categories: string[] = [];
        let mandatory: boolean[] = [];
        user.profile.positions.forEach((position) => {
            categories.push("Position");
            mandatory.push(true);
        });
        profileAsSurveys.positions = getProfileFieldsAsSurvey(user, categories, self, "Update position", mandatory);
    }
    profileAsSurveys.addPosition = getProfileFieldsAsSurvey(user, ["Position"], self, "Update position", [true], user.profile.positions.length)
    if(user.profile.education && user.profile.education.length>0) {
        let categories: string[] = [];
        let mandatory: boolean[] = [];
        user.profile.education.forEach((edu) =>{
            categories.push("Education");
            mandatory.push(true);
        });
        profileAsSurveys.education = getProfileFieldsAsSurvey(user, categories, self, "Update education", mandatory);
    }
    profileAsSurveys.addEducation = getProfileFieldsAsSurvey(user, ["Education"], self, "Update education", [true], user.profile.education.length);
   
    profileAsSurveys.programs = [];
    const profileCategories = [ "Current Location",  "Skills", "ExpInYrs", "Job Level", "Function", "Industry", "Age", "Gender", "Background", "Photo", "Contact", "Position", "Education"];
    user.programs.forEach(program => {
        if(program.signup_pre){
            let newSurvey= surveys.find(element => element._id.equals(program.signup_pre.survey));
            let nonProfileQuestions =newSurvey ? newSurvey.questions.filter(element => profileCategories.find(elem => elem == element.category) === undefined):undefined;
            if(newSurvey && nonProfileQuestions && nonProfileQuestions.length > 0) {
                if(program.role) nonProfileQuestions = nonProfileQuestions.filter(element => element.roles.find(elem => elem == program.role) !== undefined);
                logger.debug("nonProfileQuestions", program.role, nonProfileQuestions.toString())
                if(nonProfileQuestions && nonProfileQuestions.length > 0) {
                    let userSurvey =  <UserSurveyModel>JSON.parse(JSON.stringify(newSurvey));
                    userSurvey.userProgramId = (program as any)._id;
                    userSurvey.programId = program.program;
                    let filteredAnswers = program.signup_pre.answers.filter(element => nonProfileQuestions.find(elem => (elem as any)._id.equals(element.qid)) !== undefined);
                    logger.debug("userSurvey", userSurvey)
                    if(program.role) program.signup_pre.role = program.role;
                    if(program.is_mentor) program.signup_pre.is_mentor = program.is_mentor;
                    profileAsSurveys.programs.push({survey: userSurvey, surveyResponse: program.signup_pre, filteredAnswers: filteredAnswers});
                }
            }
        }
        if(program.signup_post){
            let newSurvey= surveys.find(element => element._id.equals(program.signup_post.survey));
            let nonProfileQuestions = newSurvey ? newSurvey.questions.filter(element => profileCategories.find(elem => elem == element.category) === undefined): undefined;
            if(newSurvey && nonProfileQuestions && nonProfileQuestions.length > 0) {
                if(program.role) nonProfileQuestions = nonProfileQuestions.filter(element => element.roles.find(elem => elem == program.role) !== undefined);
                if(nonProfileQuestions && nonProfileQuestions.length > 0) {
                    let userSurvey =  <UserSurveyModel>JSON.parse(JSON.stringify(newSurvey));
                    userSurvey.userProgramId = (program as any)._id;
                    userSurvey.programId = program.program;
                    let filteredAnswers = program.signup_post.answers.filter(element => nonProfileQuestions.find(elem => (elem as any)._id.equals(element.qid)) !== undefined);
                    if(program.role) program.signup_post.role = program.role;
                    if(program.is_mentor) program.signup_post.is_mentor = program.is_mentor;
                    profileAsSurveys.programs.push({survey: userSurvey, surveyResponse: program.signup_post, filteredAnswers: filteredAnswers});
                }
            }
        }
    });

    return profileAsSurveys;
};
