import * as mongoose  from "mongoose";
import { UserBriefSchema, UserBriefModel, ImgStore } from "./shared-model";

export type ProgramModel = mongoose.Document & {
    site: string,
    admins: [UserBriefModel],
    profile: {
        name: string,
        invite_code: string,
        is_default: boolean,
        goal: string, // Diversity Initiative, Knowledge Development, Work/Family Support, Leadership Development, Talent Retention, Job Training, New Employee Socialization, Succession Planning, Network Building, Corporate Understanding, Problem Solving, New work processes, career planning
        desc: string,
        mentor_signup: Date,
        mentee_signup: Date,
        matching_start: Date,
        start: Date,
        end: Date,
        invite_only: boolean,
        can_invite: boolean,
        mentors_approval_matching: boolean,
        img_id: string,
        img_path: string,
        thumbnail: string,
        img_store: string,
    },
    notification: [{
        category: string, // mentor sign up, mentee sign up, initiate feedback survey, mentor_welcome, mentee welcome
        short: string,
        desc: string
    }],
    matching: [{
        property: string,
        weight: number,
        mustMatch: boolean
    }],
    pledges: [{
        title: string,
        desc: string,
        order: number
    }]
  };
export const ProgramGoal = [ "Career planning",  "Corporate Understanding", "Diversity Initiative",  "Job Training",  "Knowledge Development",  "Leadership Development",  "Network Building",  "New Employee Socialization",  "New work processes",  "Problem Solving",  "Succession Planning",  "Talent Retention",  "Work/Family Support"];
// Program Schema
const ProgramSchema = new mongoose.Schema({
    site: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    admins: [UserBriefSchema],
    profile: {
        name: String,
        invite_code: String,
        is_default: Boolean,
        goal: { type: String, enum: ProgramGoal },
        desc: String,
        mentor_signup: Date,
        mentee_signup: Date,
        matching_start: Date,
        start: Date,
        end: Date,
        invite_only: Boolean,
        can_invite: Boolean,
        mentors_approval_matching: Boolean,
        img_id: String,
        img_path: String,
        thumbnail: String,
        img_store: { type: String, enum: ImgStore }
    },
    notification: [{
        category: String,
        short: String,
        desc: String
    }],
    matching: [{
        property: String,
        weight: Number,
        mustMatch: Boolean
    }],
    pledges: [{
        title: String,
        desc: String,
        order: Number
    }]
}, {
    timestamps : true
});
ProgramSchema.index({'site': 1, 'profile.is_default': 1}, {sparse: true});
const Program = mongoose.model< ProgramModel >("Program", ProgramSchema);
export default Program;

