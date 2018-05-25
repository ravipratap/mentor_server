import * as mongoose  from "mongoose";
import { UserBriefModel, UserBriefSchema, QuestionCategory } from "./shared-model";

export type SurveyModel = mongoose.Document & {
    profile: {
        site: string,
        program: string,
        category: string,
        // is_default: boolean,
        invite_code: string,
        code_expires: Date,
        title: string,
        navTitle: string,
        details: string,
        is_template: boolean,
        schedule: string
    },
    questions: [{
        order: number,
        question: string,
        seperate_question: boolean,
        mentor_question: string,
        category: string,
        mandatory: boolean,
        other_choice: boolean,
        placeholder: string,
        roles: [string],
        choices: [{
            text: string,
            votes: [string],
            comments: [{
                text: string,
                by: string
            }],
            order: number
        }]
    }],
    createdBy: UserBriefModel
  };

export type UserSurveyModel = SurveyModel & {
    userProgramId?: string,
    programId?: string
}
export const SurveyCategory = ["Interview", "Signup", "PostSignup", "Review", "Program Review", "Business Plan", "Poll", "Profile"];
export const ScheduleFrequency = ["Not Scheduled", "Monthly", "Introduction", "Call Completion", "Post Meeting", "Goal/Plan Update", "Completion"];
// Survey Schema
export const SurveySchema = new mongoose.Schema({ 
    profile: {
        site: mongoose.Schema.Types.ObjectId,
        program: mongoose.Schema.Types.ObjectId,
        category: { type: String, enum: SurveyCategory },
        // is_default: { type: Boolean, default: "false" },
        invite_code: String,
        code_expires: Date,
        title: String,
        navTitle: String,
        details: String,
        is_template: { type: Boolean, default: "false" },
        schedule: { type: String, enum: ScheduleFrequency }
    },
    questions: [{
        order: Number,
        question: String,
        seperate_question: Boolean,
        mentor_question: String,
        category: { type: String, enum: QuestionCategory },
        mandatory: Boolean,
        other_choice: Boolean,
        placeholder: String,
        roles: [String],
        choices: [{
            _id: false,
            text: String,
            votes: [mongoose.Schema.Types.ObjectId],
            comments: [{
                text: String,
                by: mongoose.Schema.Types.ObjectId
            }],
            order: Number
        }]
    }],
    createdBy: UserBriefSchema
}, {
    timestamps : true
});
SurveySchema.index({"category": 1, "is_template": 1});
const Survey = mongoose.model< SurveyModel >("Survey", SurveySchema);
export default Survey;

