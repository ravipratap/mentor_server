import * as mongoose  from "mongoose";
import { MentoringGoal } from "./program-model";
import { ImgStore, UserBriefModel, UserBriefSchema } from "./shared-model";

export type ConnectionModel = mongoose.Document & {
    profile: {
        name: string,
        goal: string, // one of the site"s goal
        status: string,
        program: string,
        img_id: string,
        img_path: string,
        thumbnail: string,
        img_store: string
    },
    stats: {
        activity_type: string
        activity_date: Date,
        logins: number,
        messages: number,
        meetings: number,
        reviews: number
    },
    admins: [UserBriefModel],
    mentees: [{
        profile: UserBriefModel,
        read: Date,
        intro: Date,
        goals: Date,
        review: Date
    }],
    mentors: [{
        profile: UserBriefModel,
        read: Date,
        intro: Date,
        plan: Date,
        review: Date
    }]
  };
export const ConnectionStatus = ["Open", "Closed"];

export const ActivityTypes = ["Signed Up", "Introduced", "GoalsSet","ActionPlan", "Meetings", 
    "TaskUpdates", "Chats", "Calls", "Feedback","MentorFeedback", "MenteeFeedback" ];

// Connection Schema
const ConnectionSchema = new mongoose.Schema({
    profile: {
        name: String,
        goal: { type: String, enum: MentoringGoal },
        status: { type: String, enum: ConnectionStatus, default: "Open" },
        program: mongoose.Schema.Types.ObjectId,
        img_id: mongoose.Schema.Types.ObjectId,
        img_path: String,
        thumbnail: String,
        img_store: { type: String, enum: ImgStore }
    },
    stats: {
        activity_type: { type: String, enum: ActivityTypes },
        activity_date: Date,
        logins: Number,
        messages: Number,
        meetings: Number,
        reviews: Number
    },
    admins : [mongoose.Schema.Types.ObjectId],
    mentees: [{
        profile: UserBriefSchema,
        read: Date,
        intro: Date,
        goals: Date,
        review: Date

    }],
    mentors: [{
        profile: UserBriefSchema,
        read: Date,
        intro: Date,
        plan: Date,
        review: Date
    }]
}, {
    timestamps : true
});
ConnectionSchema.index({"users.id": 1});
const Connection = mongoose.model< ConnectionModel >("Connection", ConnectionSchema);
export default Connection;

