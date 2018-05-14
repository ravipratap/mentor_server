
import * as mongo from "connect-mongo";
import * as mongoose from "mongoose";
import * as bluebird from "bluebird";
import * as async from "async";

import { default as User, UserModel, Roles } from "./models/user-model";
import { default as Site, SiteModel, SiteCategory, SiteStatus } from "./models/site-model";


const logger = require("./config/logger").logger;
const configs = require("./config/configs");
configs.setConfig();
// API keys and Passport configuration
const passportConfig = require("./config/passport");

// Connect to MongoDB
const mongoUrl = process.env.MONGODB_CONNECTION;
logger.debug("mongoUrl " + mongoUrl);
(<any>mongoose).Promise = bluebird;
mongoose.connect(mongoUrl, {useMongoClient: true}).then(
  () => {
    logger.info("connected successfully");
    async.waterfall([
        createDefaultSite,
        createAdminUser
    ], function (err, result) {
        if ( err ) {
            logger.error("error in waterfall: " + err);
            throw err;
        } else {
            logger.info("updation complete : " + result );
        }
        process.exit(0);
    });
  },
).catch(err => {
  console.log("MongoDB connection error. Please make sure MongoDB is running. " + err);
  // process.exit();
});

const createDefaultSite = ( done: Function ) => {
    logger.debug("starting default site creation");
    const newSite = new Site({
        profile: {
            company: "Mentor Rank",
            type: SiteCategory.find( (element) => element == "Platform" )
        },
        config: {
            theme: "theme-insta",
            mentor: true
        },
        license: {
            status: SiteStatus.find( (element) => element == "Active" ),
            start: new Date(),
            activation: new Date()
        },
    });
    logger.debug(newSite.config);
    Site.getDefaultModel(( err: Error, existingSite: SiteModel ) => {
        if ( err ) {
            logger.error("error in setting site: " + err);
        }

        if ( existingSite ) {
            logger.error("Site exists: " + existingSite);
            done(undefined, existingSite._id);
        } else {
            newSite.save( ( err: Error, site: SiteModel ) => {
                if ( err ) {
                    logger.error("Failed to register default site");
                } else {
                    logger.info("site id:" + site._id);
                    done(undefined, site._id);
                }
            });
        }
    });
};
const createAdminUser = (siteId: string, done: Function) => {
    const newUser = new User({
        sign: {
            first: "Admin"
        },
        login: {
            email: "admin@admin.com",
            role: Roles.find((element) => element == "SuperAdmin")
        }, 
        pass: {
            password: "password"
        },
        logs: {
            signup:  new Date(),
            completion_score: 10
        }
    });
    newUser.site = siteId;

    User.getUserByMobileOrEmail(newUser.login.email, undefined, siteId, 'site' , function(err: Error, existingUser: UserModel) {

       if ( err ) {
            logger.error("error in finding admin user: " + err);
        }

        if ( existingUser ) {
            logger.error("admin user exists: " + existingUser);
            done(undefined, existingUser._id);
        } else {

            User.addUser(newUser, false, (err: Error, user: UserModel) => {
                if ( err ) {
                    logger.error("Failed to register admin user");
                } else {
                    logger.info("admin user id:" + user._id);
                }
                done(undefined, user._id);
            });
        }
    });
    // end
};


