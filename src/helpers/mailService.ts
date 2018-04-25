import { UserModel } from "../models/user-model";
import { ProgramModel } from "../models/program-model";
import { SiteModel } from "../models/site-model";

const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API);

const logger = require("../config/logger").logger;

export let sendVerifyMail = (savedUser: UserModel) => {
    
    const msg = {
    to: 'ravi.pratap@gmail.com',
    from: 'mentor@mentorrank.com',
    subject: 'Please verify your email on MentorRank',
    text: `Hi ${savedUser.sign.first}
        To verify your email, please enter the following OTP on mentorRank:
        ${savedUser.login.email_token}
        Alternatively, you can click on the link ${process.env.CLIENT_URL}/#/reset-password/${savedUser.login.email_token}
        Thanks, 
        MentorRank Team`,
    html: `<p>Hi ${savedUser.sign.first},</p>
        <p> To verify your email, please enter the following OTP on mentorRank: </p>
        <strong>${savedUser.login.email_token}</strong>
        <p>Alternatively, you can  
        <a href="${process.env.CLIENT_URL}/#/reset-password/${savedUser.login.email_token}" > click on the link </a> </p><img 
        src="${process.env.SERVER_URL}users/mailOpen?t=verify&upn=${savedUser._id}" alt="" 
        width="1" height="1" border="0" style="height:1px !important;width:1px !important;
        border-width:0 !important;margin-top:0 !important;margin-bottom:0 !important;
        margin-right:0 !important;margin-left:0 !important;padding-top:0 !important;
        padding-bottom:0 !important;padding-right:0 !important;padding-left:0 !important;"/>`,
    };
    sgMail.send(msg).then((clientResponse: any) => { 
        logger.debug("sending mail successful", " msg: ", msg);
    //    logger.debug("sending mail successful", clientResponse, " msg: ", msg);
    },
    (err: any)  =>  {
        logger.error("Error in sending mail", err);
    },
    () => {
        logger.debug("Send  Message complete");
    });
};

export let notifyAdminsByMail =  (admins: UserModel[], savedSite: SiteModel, setUsers: UserModel[], setProgramAdminUsers: UserModel[], setSiteAdminUsers: UserModel[], newUsers: UserModel[], existingUsers: UserModel[], savedProgram: ProgramModel) => {
    logger.debug("sendV SMS to admins ");
}