import * as winston  from "winston";

const level = process.env.LOG_LEVEL || "debug";

export const logger = new winston.Logger({
    transports: [
        new winston.transports.Console({
            level: level,
            prettyPrint: true,
            colorize: true,
            timestamp: function () {
                return (new Date()).toISOString();
            }
        })
    ]
});

