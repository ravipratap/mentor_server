import * as mongoose  from "mongoose";
import { UserBriefSchema, UserBriefModel } from "./shared-model";
const logger = require("../config/logger").logger;

export type SiteModel = mongoose.Document & {
    profile: {
        company: string,
        domain: string,
        email_domains: [string],
        category: string
    },
    config: {
      theme: string, // Job Level, Function, Gender, Cities, Skills
      signup_pre?: string,
      signup_post?: string,
      jobLevels?: [string],
      genders?: [string],
      functions?: [string],
      cities?: [string],
      roles?: [string]
    },
    license: {
        status: string,
        start: Date,
        activation: Date,
        end: Date,
        plan: string,
        users: number
    },
    admins: [UserBriefModel]

  };
 interface ISiteModel extends mongoose.Model<SiteModel> {
    getDefaultModel: (callback: Function) => any;
    getSiteByEmailOrDomain: (email: string, domain: string, callback: Function) => any;
  }
export const SiteCategory = ["Platform", "School", "Association", "Firm", "Enterprise"];

export const SiteStatus = ["Pending", "Active", "Expired"];
export const SitePlans = ["Lite", "Pro", "Enterprise"];
// Site Schema
const SiteSchema = new mongoose.Schema({
    profile: {
        company: String,
        domain: {
            type: String,
            index: true,
            sparse: true
        },
        email_domains: {
            type: [String],
            index: true,
            sparse: true
        },
        category: { type: String, enum: SiteCategory}
    },
    config: {
      theme: String,
      signup_pre: String,
      signup_post: String,
      jobLevels: [String],
      genders: [String], 
      functions: [String],
      cities: [String],
      roles: [String]
    },
    license: {
        status: { type: String, enum: SiteStatus, default: "Pending"},
        start: Date,
        activation: Date,
        end: Date,
        plan:  { type: String, enum: SitePlans},
        users: Number
    },
    admins: [UserBriefSchema],
}, {
    timestamps : true
});
SiteSchema.statics.getDefaultModel = (callback: Function) => {
    const query = {"profile.category": "Platform"};
    Site.findOne(query, callback);
};

SiteSchema.statics.getSiteByEmailOrDomain = (email: string, domain: string,  callback: Function) => {
    let query;
    if ( email && domain ) {
        query = {$or: [{"profile.email_domains" : email}, {"profile.domain" : domain}]};
    } else if ( domain ) {
        query = {"profile.domain": domain};
    } else {
        query = {"profile.email_domains": email};
    }
    console.log("getSiteByEmailOrDomain", email, domain);
    Site.find(query, "profile config", ( err:Error, existingSites: SiteModel[] ) => {
        if(err) {
            logger.error("Error in getting site", err);
            callback(err, undefined);
        }
        if ( existingSites && existingSites.length == 1 ) {
            callback(undefined, existingSites[0]);
        } else if ( existingSites && existingSites.length > 1 ) {
            let existingSite: SiteModel;
            existingSites.forEach((site, index) => {
                if(site.profile.email_domains && site.profile.email_domains.indexOf(email)>-1){
                    existingSite = site;
                }
            });
            if(!existingSite) {
                logger.debug("existingSites", existingSites?existingSites.toString():existingSites);
                existingSite = existingSites[0];
            }
            callback(undefined, existingSite);
        } else {
            query = {"profile.category": "Platform"};
            Site.findOne(query, "profile config", callback);
        }
    });
};

const Site = mongoose.model< SiteModel, ISiteModel >("Site", SiteSchema);
export default Site;

