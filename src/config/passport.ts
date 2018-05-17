
import * as passport from "passport";
import * as jwt from "jsonwebtoken";
import { Strategy, ExtractJwt } from "passport-jwt";
import User, { UserModel } from "../models/user-model";
import {  Request, Response, NextFunction } from "express";
const logger = require("./logger").logger;

class PassportAuth {

    public initialize = () => {
        passport.use("jwt", this.getStrategy());
        return passport.initialize();
    }

    public authenticate = (callback:any) => passport.authenticate("jwt", { session: false, failWithError: true }, callback);

    

    public getJWTtoken = (user: UserModel) => {
        let userForToken: any;
        userForToken =  {
                _id: user._id,
                name: user.fullName,
                site: user.site,
                verified: user.verified,
                role: user.login.role
            };
        const token = jwt.sign(userForToken, process.env.JWT_SECRET, {
            expiresIn: 604800 // 1 week
        });
        userForToken.site = user.site;
        // userForToken.theme = site.profile.config.theme;
        userForToken.score = user.logs.completion_score;
        if(user.pic){
            userForToken.thumbnail = user.pic.thumbnail;
            userForToken.img_store = user.pic.img_store;
        }
        userForToken.expires = new Date( Date.now() + 604800 * 1000 );
    
        return {
            token:          token,
            userForToken:   userForToken
        };
    };

    public  roleAuthorization = function(roles: string[]) {

        return function(req: Request, res: Response, next: NextFunction) {
    
            const user = req.user;
    
             // getting user data from token and not from DB
            if ( roles.indexOf(user.role) > -1 ) {
                    return next();
                }
    
            res.status(401).json({error: "You are not authorized to view this content"});
            return next("Unauthorized");
    
            /*User.getUserById(user._id, function(err, foundUser){
    
                if(err){
                    res.status(422).json({error: "No user found."});
                    return next(err);
                }
                logger.debug("foundUser "+ foundUser);
                if(roles.indexOf(foundUser.role) > -1){
                    return next();
                }
    
                res.status(401).json({error: "You are not authorized to view this content"});
                return next("Unauthorized");
    
            });*/
    
        };
    
    };

    public recentlyLoggedIn = () => {
    
        return function(req: Request, res: Response, next: NextFunction) {
    
            const user = req.user;
            // logged in less than hour ago
            if ( user.issued > 3600 ) {
                res.status(401).json({error: "You are not authorized to view this content"});
                return next("Unauthorized");
            } else  {
                return next();
            }
    
        };
    
    };

    public decodeToken = (authorization: string, callback: any) => {
        // logger.debug("process.env.JWT_SECRET", process.env.JWT_SECRET, "token", token);
        let token: string;
        if(authorization){
            let parts= authorization.split(" ");
            if(parts && parts.length==2){
                token = parts[1];
            }
        }
        // logger.debug("token", token);
        jwt.verify(token, process.env.JWT_SECRET, callback);
    };

    public getUserFromDecodedToken = (jwt_payload: any) => {
        const issuedAt = new Date( jwt_payload.iat * 1000 );
        const timeFromIssue = ( Date.now() / 1000 - jwt_payload.iat );
        // logger.debug("token was issued at "+ issuedAt + " and time from issue is "+ timeFromIssue) ;
        
        const user = {
            _id: jwt_payload._id,
            name: jwt_payload.name,
            verified: jwt_payload.verified,
            role: jwt_payload.role,
            site: jwt_payload.site,
            issued: timeFromIssue
        };
        return user;
    };

    private getStrategy = (): Strategy => {
        // const params = {
        //     secretOrKey: process.env.JWT_SECRET,
        //     jwtFromRequest: ExtractJwt.fromAuthHeader(),
        //     passReqToCallback: true
        // };
        const opts: any = {
            jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme("jwt"),
            secretOrKey: process.env.JWT_SECRET
        };
        const that= this;
        return new Strategy(opts, function(jwt_payload: any, done: Function) {
            // logger.debug(jwt_payload);

            const user = that.getUserFromDecodedToken(jwt_payload);
            //getting user data from token and not from DB
            if (user) {
                done(undefined, user);
            } else {
                done(undefined, false);
            }
            /*User.getUserById(jwt_payload.id, function(err, user) {
                if (err) {
                    return done(err, false);
                }
                if (user) {
                    done(undefined, user);
                } else {
                    done(undefined, false);
                    // or you could create a new account 
                }
            });*/
        });
    }

}

export default new PassportAuth();

// module.exports = (passport: any ) => {
//     const opts: any = {};
//     opts.jwtFromRequest = ExtractJwt.fromAuthHeaderWithScheme("jwt");
//     opts.secretOrKey = process.env.JWT_SECRET;
//     passport.use(new Strategy(opts, function(jwt_payload: any, done: Function) {
//         // logger.debug(jwt_payload);
//         const issuedAt = new Date( jwt_payload.iat * 1000 );
//         const timeFromIssue = ( Date.now() / 1000 - jwt_payload.iat );
//         // logger.debug("token was issued at "+ issuedAt + " and time from issue is "+ timeFromIssue) ;
        
//         const user = {
//             _id: jwt_payload._id,
//             name: jwt_payload.name,
//             verified: jwt_payload.verified,
//             role: jwt_payload.role,
//             site: jwt_payload.site,
//             issued: timeFromIssue
//         };
//         //getting user data from token and not from DB
//         if (user) {
//             done(undefined, user);
//         } else {
//             done(undefined, false);
//         }
//     }));
// };

// module.exports = (passport: any ) => {
//     const opts: any = {};
//     opts.jwtFromRequest = ExtractJwt.fromAuthHeaderWithScheme("jwt");
//     opts.secretOrKey = process.env.JWT_SECRET;
//     passport.use(new Strategy(opts, function(jwt_payload: any, done: Function) {
//         // logger.debug(jwt_payload);
//         const issuedAt = new Date( jwt_payload.iat * 1000 );
//         const timeFromIssue = ( Date.now() / 1000 - jwt_payload.iat );
//         // logger.debug("token was issued at "+ issuedAt + " and time from issue is "+ timeFromIssue) ;
        
//         const user = {
//             _id: jwt_payload._id,
//             name: jwt_payload.name,
//             verified: jwt_payload.verified,
//             role: jwt_payload.role,
//             site: jwt_payload.site,
//             issued: timeFromIssue
//         };
//         //getting user data from token and not from DB
//         if (user) {
//             done(undefined, user);
//         } else {
//             done(undefined, false);
//             // or you could create a new account 
//         }
//         /*User.getUserById(jwt_payload.id, function(err, user) {
//             if (err) {
//                 return done(err, false);
//             }
//             if (user) {
//                 done(undefined, user);
//             } else {
//                 done(undefined, false);
//                 // or you could create a new account 
//             }
//         });*/
//     }));
// };

