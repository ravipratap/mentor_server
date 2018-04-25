// const mongoose = require("mongoose");
// const bcrypt = require("bcryptjs");
import * as bcrypt from "bcrypt-nodejs";
// import * as crypto from "crypto";
import * as mongoose from "mongoose";
import { UserBriefModel, SurveyResponseModel, ImgStore, SurveyResponseSchema, UserBriefSchema } from "./shared-model";
const logger = require("../config/logger").logger;
const BCRYPT_SALT_LEN = 9;


export type AuthToken = {
token: string,
kind: string,
provider: string
};
// export type UnverifiedProfile = {
//     email_token: string,
//     mobile_otp: string,
//     email: string,
//     mobile: string,
//     updated: Date
// }

export type UserModel = mongoose.Document & {
    site: string,
    login: {
        role: string,
        email: string,
        mobile: string,
        mobile_verified: boolean,
        email_verified: boolean,
        email_token: string,
        email_token_expires: Date,
        mobile_otp: string,
        mobile_otp_expires: Date,
        // unverified: [UnverifiedProfile],
        facebook: string,
        google: string,
        linkedin: string,
        tokens: AuthToken[]
    },
    pass: {
        password: string
    }
    sign: {
        first: string,
        last: string,
        title: string
    },
    pic: {
        img_id?: string,
        img_store?: string,
        thumbnail?: string,
        img_path?: string
    }
    profile: {
        age?: number,
        age_range?: {
            min: Number,
            max: Number
        },
        expInYrs?: number, //0 for student,
        isStudent?: boolean,
        positions?: [{
            title: string,
            company: {
                id: string,
                name: string,
                industry: string,
                size: string,
                ticker: string,
                category: string
            },
            location: {
                name: string,
                country: {
                    code: string,
                    name: string
                }
            },
            isCurrent: boolean,
            startDate: {
                month: number,
                year: number
            },
            endDate: {
                month: number,
                year: number
            }
        }],
        education?:[{
            school: {
                id: string,
                name: string,
                premier: boolean
            },
            degree: string,
            fieldsOfStudy: [string],
            startYear: number,
            endYear: number
        }],
        gender?: string,
        level?: string,
        industry?: [string],
        function?: [string],
        skills?: [string],
        location?: {
            name: string,
            country: {
                code: string,
                name: string
            }
        },
        intro?: {
            txt: string,
            linkedin: string,
            facebook: string,
            twitter: string,
            blog: string
        }
    },
    logs: {
        last_login: Date,
        last_active: Date,
        signup: Date,
        online: boolean,
        available: boolean,
        completion_score?: number, // 1 signed up, 2 basic profile, 3 picture, 4 matching, 5 pledge completed
        invite_code?: string, // use it to invite other users
        invited?: number,
        status?: string,
        status_update?: Date
    },
    seeking: {
        willing: boolean,
        mentors: Number,
        function: [string],
        industry: [string],
        why_me: string,
        questions: [string],
        highFlyer: string,
        tenure: number, // organization tenue
        promoted: Date
    },
    mentees: [{
        id: string,
        program: string,
        requested: Date,
        viewed: Date,
        approoved: Date,
        status: string,
        blocked: boolean
    }],
    giving: {
        willing: boolean,
        mentees: number,
        function: [string],
        industry: [string],
        levels: number,
        my_school: boolean,
        my_company: boolean,
        my_region: boolean,
        expertise: [string],
        leadership: number,
        slots: number,
        hours: number,
        meeting: {
            frequency: string,
            charge: number,
            currency: string,
            critera: string
        },
        call: {
            frequency: string,
            charge: number,
            currency: string,
            critera: string
        },
        chat: {
            frequency: string,
            charge: number,
            currency: string,
            critera: string
        }
    },
    reviews: [{
        user: UserBriefModel
        rating: number,
        body: string
    }],
    programs: [{
        program: string,
        status: string,
        invited ?: [string],
        is_mentor?: boolean,
        role?: string,
        signup_pre?: SurveyResponseModel,
        signup_post?: SurveyResponseModel
    }],
    fullName(): string,
    verified(): boolean
    // gravatar: (size: number) => string
  };

interface IUserModel extends mongoose.Model< UserModel > {
    getUserByMobileOrEmail: (email: string, mobile: string, siteId: string, projection: string, callback: Function) => any;
    getUserById: (id: string, callback: Function) => any;
    getUserByUsername: (username: string, siteId: string, isApp: boolean,  projection: string, callback: Function) => any;
    addUser: (newUser: any, update:boolean, callback: Function) => void;
    comparePassword: (candidatePassword: string, hash: string, callback: Function) => boolean;
}
export const Roles = ["User", "ProgramAdmin", "SiteAdmin", "SuperAdmin"];
export const ApplicationStatus = ["Pending", "Approved", "Rejected", "Profile Approved"];
// User Schema
const userSchema = new mongoose.Schema({
    site: { type: mongoose.Schema.Types.ObjectId, required: true },
    login: {
        role: {
            type : String,
            enum : Roles,
            default : "user"
        },
        email: {
            type : String,
            required: false,
            index: true
        },
        mobile: {
            type : String,
            required: false,
            index: true
        },
        mobile_verified: { type: Boolean, default: false },
        email_verified: { type: Boolean, default: false },
        email_token: String,
        email_token_expires: Date,
        mobile_otp: String,
        mobile_otp_expires: Date,
        // unverified: Array,
        facebook: String,
        google: String,
        linkedin: String,
        tokens: Array,
    },
    pass:{
        password: String
    },
    sign: {
        first: String,
        last: String,
        title: String
    },
    pic: {
        img_id: mongoose.Schema.Types.ObjectId,
        img_store: { type: String, enum: ImgStore },
        thumbnail: String,
        img_path: String
    },
    profile: {
        age: Number,
        age_range: {
            min: Number,
            max: Number
        },
        expInYrs: Number,
        isStudent: Boolean,
        positions: [{
            title: String,
            company: {
                id: String,
                name: String,
                industry: String,
                size: String,
                ticker: String,
                category: String
            },
            location: {
                name: String,
                country: {
                    code: String,
                    name: String
                }
            },
            isCurrent: Boolean,
            startDate: {
                month: Number,
                year: Number
            },
            endDate: {
                month: Number,
                year: Number
            }
        }],
        education:[{
            school: {
                id: String,
                name: String,
                premier: Boolean
            },
            degree: String,
            fieldsOfStudy: [String],
            startYear: Number,
            endYear: Number
        }],
        gender: String,
        level: String,
        industry: [String],
        function: [String],
        skills: [String],
        
        location: {
            name: String,
            country: {
                code: String,
                name: String
            }
        },
        intro: {
            txt: String,
            linkedin: String,
            facebook: String,
            twitter: String,
            blog: String
        }
    },
    signups: [SurveyResponseSchema],
    logs: {
        last_login: Date,
        last_active: Date,
        signup: Date,
        online:  { type: Boolean, default: false  },
        available:  { type: Boolean, default: false  },
        completion_score: Number,
        invite_code: String,
        invited: Number,
        status: { type: String, enum: ApplicationStatus },
        status_update: Date
    },
    seeking: {
        willing: Boolean,
        mentors: Number,
        function: [String],
        industry: [String],
        why_me: String,
        questions: [String],
        highFlyer: String,
        tenure: Number, // organization tenue
        promoted: Date
    },
    mentees: [{
        id: mongoose.Schema.Types.ObjectId,
        program: mongoose.Schema.Types.ObjectId,
        requested: Date,
        viewed: Date,
        approoved: Date,
        goal: String, // one of the site"s goal
        status: String,
        blocked: Boolean
    }],
    giving: {
        willing: Boolean,
        mentees: Number,
        function: [String],
        industry: [String],
        levels: Number,
        my_school: Boolean,
        my_company: Boolean,
        my_region: Boolean,
        expertise: [String],
        leadership: Number,
        slots: Number,
        hours: Number,
        meeting: {
            frequency: String,
            charge: Number,
            currency: String,
            critera: String
        },
        call: {
            frequency: String,
            charge: Number,
            currency: String,
            critera: String
        },
        chat: {
            frequency: String,
            charge: Number,
            currency: String,
            critera: String
        }
    },
    reviews: [{
        user: UserBriefSchema,
        rating: Number,
        body: String
    }],
    programs: [{
        program: mongoose.Schema.Types.ObjectId,
        status: { type: String, enum: ApplicationStatus },
        invited: [mongoose.Schema.Types.ObjectId],
        is_mentor: Boolean,
        role: String,
        signup_pre: SurveyResponseSchema,
        signup_post: SurveyResponseSchema
    }]

}, {
    timestamps : true
});

userSchema.virtual("fullName").get(function (): string {
    let fullName = "";
    if ( this.sign.first ) {
        fullName += this.sign.first;
    }
    if ( this.sign.last ) {
        fullName += " " + this.sign.last;
    }
  return fullName;
});
userSchema.virtual("verified").get(function (): boolean {
  return this.login.mobile_verified || this.login.email_verified;
});


userSchema.statics.getUserById = (id: string, callback: Function) => {
    console.log("id is" + id);
    User.findById(id, callback);
};

userSchema.statics.getUserByUsername = (username: string, siteId: string, isApp : boolean, projection: string,  callback: Function) => {
    let subquery: any;
    if ( username.indexOf("@") != -1 ) {
        subquery = {"login.email": username};
    } else {
        subquery = {"login.mobile": username};
    }
    // const query= { $and: [subquery, { site: siteId } ] };
    User.find(subquery, projection, (err: Error, users: UserModel[]) => {
        // logger.debug("getUserByUsername", siteId, subquery, JSON.stringify(users), err)
        if(err || !users) callback(err, undefined);
        let existingUser: UserModel;
        users.forEach((user, index) => {
            // logger.debug("user.site == siteId", user.site, JSON.stringify(siteId), user.site.toString() == siteId);
            if(user.site.toString() == siteId){
                existingUser = user;
            }
        });
        // logger.debug("existingUser", existingUser.toString());
        if(!existingUser && isApp) { // Allow user from any site to login app with non domain email id
            logger.debug("existingUsers", users);
            existingUser = users[0];
        }
        callback(undefined, existingUser);
    });
};
userSchema.statics.getUserByMobileOrEmail = (email: string, mobile: string, siteId: string, projection: string, callback: Function) => {
    let subquery;
    if ( email && mobile ) {
        subquery = {$or: [{"login.email" : email}, {"login.mobile" : mobile}]};
    } else if ( mobile ) {
        subquery = {"login.mobile": mobile};
    } else {
        subquery = {"login.email": email};
    }
    const query= { $and: [subquery, { site: siteId } ] };
    User.findOne(query,"site login sign profile pic signups logs", callback);
};

userSchema.statics.addUser = (newUser: UserModel, update:boolean, callback: any) => {
    bcrypt.genSalt(BCRYPT_SALT_LEN, (err, salt) => {
        if ( err ) {
            logger.debug("error in bcrypt salth generation", err)
            throw err;
        }
        bcrypt.hash(newUser.pass.password, salt, undefined, (err, hash) => {
            if ( err ) {
                logger.debug("error in bcrypt hashing", err)
                throw err;
            }
            newUser.pass.password = hash;
            logger.debug ("bcrypt hash password is " + hash);
            if(update){
                User.findByIdAndUpdate(newUser._id, newUser, {select: "site login sign profile pic programs logs", new: true}, callback)
            } else {
                newUser.save(callback);
            }
        });
    });
};


userSchema.statics.comparePassword = ( candidatePassword: string, hash: string, callback: Function ) => {
    bcrypt.compare(candidatePassword, hash, (err: mongoose.Error, isMatch: boolean) => {
        if ( err ) {
            // logger.debug("error in bcrypt compare", err, candidatePassword, hash);
            throw err;
        }
        callback(undefined, isMatch);
    });
};
const User = mongoose.model< UserModel, IUserModel >("User", userSchema);
export default User;