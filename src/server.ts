import * as errorHandler from "errorhandler";
const logger = require("./config/logger").logger;

// for https - start
// import * as https from "https";
// import * as fs from "fs";

// const options = {
//   key: fs.readFileSync("dist/ssl/key.pem"),
//   cert: fs.readFileSync("dist/ssl/cert.pem")
// };
// For https - end 

const app = require("./app");

/**
 * Error Handler. Provides full stack - remove for production
 */
app.use(errorHandler());

/**
 * Start http Express server.
 */
const server = app.listen(app.get("port"), () => {
  logger.info(("  Mentor App is running at http://localhost:%d in %s mode"), app.get("port"), app.get("env"));
  logger.info("  Press CTRL-C to stop\n");
});
/**
 * Start https Express server.
 */
// const server = https.createServer(options, app).listen(app.get("port"), () => {
//   logger.info(("  Mentor App is running at https://localhost:%d in %s mode"), app.get("port"), app.get("env"));
//   logger.info("  Press CTRL-C to stop\n");
// });

export = server;