import * as express from "express";
import * as compression from "compression";  // compresses requests
// import * as session from "express-session";
import * as bodyParser from "body-parser";
import * as morgan from "morgan";
// import * as lusca from "lusca";
// import * as dotenv from "dotenv";
import * as mongo from "connect-mongo";
// import * as flash from "express-flash";
import * as path from "path";
import * as mongoose from "mongoose";
import * as passport from "passport";
import * as expressValidator from "express-validator";
import * as bluebird from "bluebird";
import * as cors from "cors";

// const MongoStore = mongo(session);

// Load environment variables from .env file, where API keys and passwords are configured
// dotenv.config({ path: ".env.example" });


const logger = require("./config/logger").logger;
const configs = require("./config/configs");
configs.setConfig();

// Create Express server
const app = express();

// app.use(morgan("short"));
app.use(morgan("short", {
  skip: function (req, res) {
      return res.statusCode < 400;
  }, stream: process.stderr
}));

app.use(morgan("short", {
  skip: function (req, res) {
      return res.statusCode >= 400;
  }, stream: process.stdout
}));

// Connect to MongoDB
const mongoUrl = process.env.MONGODB_CONNECTION;
logger.debug("mongoUrl " + mongoUrl);
(<any>mongoose).Promise = bluebird;
mongoose.connect(mongoUrl, {useMongoClient: true}).then(
  () => { /** ready to use. The `mongoose.connect()` promise resolves to undefined. */ },
).catch(err => {
  console.log("MongoDB connection error. Please make sure MongoDB is running. " + err);
  // process.exit();
});

//Handinling Image upload
const cloudinary = require("cloudinary");
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

// Express configuration
app.set("port", process.env.PORT || 3000);
// app.set("views", path.join(__dirname, "../views"));
// app.set("view engine", "pug");
app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressValidator());
// app.use(session({
//   resave: true,
//   saveUninitialized: true,
//   secret: process.env.SESSION_SECRET,
//   store: new MongoStore({
//     url: mongoUrl,
//     autoReconnect: true
//   })
// }));
app.use(passport.initialize());
app.use(passport.session());
require("./config/passport")(passport);

// allow cors
app.use(cors());
app.use(express.static(path.join(__dirname, "public"), { maxAge: 31557600000 }));

// Routes
import adminRoutes from "./routes/admin-routes";
import userRoutes from "./routes/user-routes";
import searchRoutes from "./routes/search-routes";
app.use("/users", userRoutes);
app.use("/admin", adminRoutes);
app.use("/search", searchRoutes);
app.get("/", (req, res) => {
    res.send("<h1>get the best professional growth with mentor rank!!!</h1>");
});

// app.use(flash());
// app.use(lusca.xframe("SAMEORIGIN"));
// app.use(lusca.xssProtection(true));
// app.use((req, res, next) => {
//   res.locals.user = req.user;
//   next();
// });
// app.use((req, res, next) => {
//   // After successful login, redirect back to the intended page
//   if (!req.user &&
//     req.path !== "/login" &&
//     req.path !== "/signup" &&
//     !req.path.match(/^\/auth/) &&
//     !req.path.match(/\./)) {
//     req.session.returnTo = req.path;
//   } else if (req.user &&
//     req.path == "/account") {
//     req.session.returnTo = req.path;
//   }
//   next();
// });

// /**
//  * Primary app routes.
//  */
// app.get("/", homeController.index);
// app.get("/login", userController.getLogin);
// app.post("/login", userController.postLogin);
// app.get("/logout", userController.logout);
// app.get("/forgot", userController.getForgot);
// app.post("/forgot", userController.postForgot);
// app.get("/reset/:token", userController.getReset);
// app.post("/reset/:token", userController.postReset);
// app.get("/signup", userController.getSignup);
// app.post("/signup", userController.postSignup);
// app.get("/contact", contactController.getContact);
// app.post("/contact", contactController.postContact);
// app.get("/account", passportConfig.isAuthenticated, userController.getAccount);
// app.post("/account/profile", passportConfig.isAuthenticated, userController.postUpdateProfile);
// app.post("/account/password", passportConfig.isAuthenticated, userController.postUpdatePassword);
// app.post("/account/delete", passportConfig.isAuthenticated, userController.postDeleteAccount);
// app.get("/account/unlink/:provider", passportConfig.isAuthenticated, userController.getOauthUnlink);

// /**
//  * API examples routes.
//  */
// app.get("/api", apiController.getApi);
// app.get("/api/facebook", passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getFacebook);

// /**
//  * OAuth authentication routes. (Sign in)
//  */
// app.get("/auth/facebook", passport.authenticate("facebook", { scope: ["email", "public_profile"] }));
// app.get("/auth/facebook/callback", passport.authenticate("facebook", { failureRedirect: "/login" }), (req, res) => {
//   res.redirect(req.session.returnTo || "/");
// });

module.exports = app;