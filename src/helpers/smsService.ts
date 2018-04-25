import { UserModel } from "../models/user-model";
import * as https from "https";
import * as querystring from "querystring";
import { SiteModel } from "../models/site-model";
import { ProgramModel } from "../models/program-model";
const logger = require("../config/logger").logger;

//cloned from https://github.com/YodaTheCoder/TextLocal/blob/master/index.js
// error constants
const ERR_NO_VALID_CONFIG = 'No valid config for this operation.';    // for when the user tries an operation with first configuring required parameters
const ERR_API_NO_STATUS = 'API response is missing a status node.';
const ERR_API_ODD_STATUS = 'API response status node is not success or fail.';
const ERR_API_NO_ERRORS = 'API response is missing an errors node.';

// API methods, URI paths, HTTP header constants
const POST = 'POST';
const FORM = 'application/x-www-form-urlencoded';
const UTF8 = 'utf8';
const FAILURE = 'failure';
const SUCCESS = 'success';
const PATH_SEND_SMS = '/send/';

// if an API key is configured, username/password/hash will not be used
// if an API key is not configured, username is mandatory and one of hash or password is mandatory
let config:any = {
    host: 'api.textlocal.in',
    port: 443,
    username: '',
    password: '',
    hash: process.env.TEXTLOCAL_HASH,
    apikey: process.env.TEXTLOCAL_API,
    sender: 'unknown',
    test: 1
};
let sendTextLocalSMS = (numbers: any, message: string, sender: string, options: any, cb: Function) => {
    // don't proceed with an invalid config, the API is just going to reject it anyway
    let validConfig = true;

    // replace defaults with passed in options
    for (var key in options) {
        if ((options.hasOwnProperty(key)) && (config.hasOwnProperty(key))) {
            config[key] = options[key];
        }
    }

    // validate enough options are set in order to authenticate against the API
    if (0 == config.apikey.length) {
        // no api key, username must be present and one of password/hash
        if (0 == config.username.length && 0 == config.hash.length ) validConfig = false;
        if ((0 == config.password.length) && (0 == config.hash.length)) validConfig = false;
    }
    if (!validConfig) {
        return cb(new Error(ERR_NO_VALID_CONFIG));
    }

    // get auth parameters based on config settings
    let newMessage = validConfig?makeAuthParameters():{};

    // add message details to basic auth setup
    newMessage.numbers = numbers;
    newMessage.message = message;
    newMessage.sender = sender;
    newMessage.test = config.test;

    // URI encode parameters for API call
    let qs = querystring.stringify(newMessage);

    let postOptions = {
        host: config.host,
        port: config.port,
        path: PATH_SEND_SMS,
        method: POST,
        headers: {
            'Content-Type': FORM,
            'Content-Length': Buffer.byteLength(qs)
        }
    };
    logger.debug("//////////////////////////postOptions", postOptions);
    // set up the response handling
    let req = https.request(postOptions, function (res) {
        res.setEncoding(UTF8);

        let data = '';

        res.on('data', function (chunk) {
            data += chunk;
        });

        res.on('end', function () {
            let response = JSON.parse(data);

            // logger.debug("response end", response);

            if (!response.status) return cb(new Error(ERR_API_NO_STATUS));

            if (response.status === FAILURE) {
                if (!response.errors) return cb(new Error(ERR_API_NO_ERRORS));
                return cb(new Error(makeOneStringFromAPIErrorArray(response.errors)));
            }

            if (response.status !== SUCCESS) return cb(new Error(ERR_API_ODD_STATUS + '(' + response.status + ')'));

            cb(null, response);
        })
    });

    // post the data
    req.write(qs);
    req.end();
};
let makeAuthParameters = function () {
    
    if (0 < config.apikey.length) {
        return {apikey: config.apikey};
    }
    let auth:any = {
        username: config.username
    };
    if (0 < config.password.length) {
        auth.password = config.password;
    } else {
        if (0 < config.hash.length) {
            auth.hash = config.hash;
        }
    }
    return auth;
};
let makeOneStringFromAPIErrorArray = function (errorArray:any) {
    var errorString = '';
    for (var e = 0, el = errorArray.length; e < el; e++) {
        errorString += '(code ' + errorArray[e].code + ') ' + errorArray[e].message + ', ';
    }
    if (0 < errorString.length) {
        return errorString.substring(0, errorString.length - 2);
    }
    return errorString;
};




export let sendVerifySms = (savedUser: UserModel) => {
    sendTextLocalSMS("9971999080", "OTP for login to mentorRank is 123456", "TXTLCL", {}, (err:any, response?:any) => {
        if(err) logger.error("error in sending sms", err);
        logger.debug("sendVerifySms response: ", response);
        // update the current balance if the API returned the node
        if (response.balance) logger.debug("response.balance : ", response.balance);
    });
    

};
export let notifyAdminsByMail =  (admins: UserModel[], savedSite: SiteModel, setUsers: UserModel[], setProgramAdminUsers: UserModel[], setSiteAdminUsers: UserModel[], newUsers: UserModel[], existingUsers: UserModel[], savedProgram: ProgramModel) => {
    logger.debug("sendV SMS to admins ");
}