import * as mongoose  from "mongoose";
import { ScheduleFrequency } from "./survey-model";

export type CampaignModel = mongoose.Document & {
    profile: {
        site: string,
        program: string,
        is_default: boolean,
        code: string,
        title: string,
        category: string,
        link: string,
        subject: string,
        body: string,
        mentor_subject: string,
        mentor_body: string,
        schedule: string,
    },
    stats: {
        invited: number,
        opened: number,
        clicked: number,
        acted: number,
        declined: number
    }
  };
interface ICampaignModel extends mongoose.Model<CampaignModel> {
}
export const CampaignCategory = ["Invitation", "Introduction", "Review", "Program Review", "Completion", "Connection Request", "Chat Reminder",  "Meeting Reminder", "Activity Reminder", "Forgot Password", "SEM", "Site"];
// Campaign Schema
const CampaignSchema = new mongoose.Schema({   
    profile: {
        site: mongoose.Schema.Types.ObjectId,
        program: mongoose.Schema.Types.ObjectId,
        is_default: { type: Boolean, default: "false" },
        code: String,
        title: String,
        category: { type: String, enum: CampaignCategory },
        link: String,
        subject: String,
        body: String,
        mentor_subject: String,
        mentor_body: String,
        schedule: { type: String, enum: ScheduleFrequency },
    },
    stats: {
        invited: Number,
        opened: Number,
        clicked: Number,
        acted: Number,
        declined: Number
    },
}, {
    timestamps : true
});

const Campaign = mongoose.model< CampaignModel, ICampaignModel >("Campaign", CampaignSchema);
export default Campaign;

