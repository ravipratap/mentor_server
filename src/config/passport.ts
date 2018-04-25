const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const User = require("../models/user-model");
const logger = require("./logger").logger;

module.exports = (passport: any ) => {
    const opts: any = {};
    // opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
    opts.jwtFromRequest = ExtractJwt.fromAuthHeaderWithScheme("jwt");
    opts.secretOrKey = process.env.JWT_SECRET;
    passport.use(new JwtStrategy(opts, function(jwt_payload: any, done: Function) {
        // logger.debug(jwt_payload);
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
        //getting user data from token and not from DB
        if (user) {
            done(undefined, user);
        } else {
            done(undefined, false);
            // or you could create a new account 
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
    }));
};

