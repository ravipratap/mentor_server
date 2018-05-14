
import * as mongoose from "mongoose";
export type UserBriefModel = mongoose.Document & {
    id: string,
    sign?: {
        first: string,
        thumbnail: string,
        img_store: string
    },
};

export const ImgStore = ["local", "aws", "cloudinary"];
export const UserBriefSchema = new mongoose.Schema({
    id: mongoose.Schema.Types.ObjectId,
    sign: {
        first: String,
        thumbnail: String,
        img_store: { type: String, enum: ImgStore }
    }
});
export interface SurveyResponseModel extends mongoose.Document {    
    survey: string,
    is_mentor?: boolean,
    role?: string,
    answered?: boolean,
    answers?: [{
        order: number,
        qid: string,
        question: string,
        category: string,
        answer: any
    }]
}; 

const options = { discriminatorKey : "kind"};
export const QuestionCategory = ["Multiple", "Radio", "Yes/No",  "Star Rating", "NPS", "Text", "Number", "URL", "Email", "Telephone", "Current Location", "Location", "Skills", "ExpInYrs", "Job Level", "Function", "Industry", "Age", "Gender", "Role", "Background", "Photo", "Company", "Designation", "School", "Degree", "Sign", "Contact", "Position", "Education"];
export const SurveyResponseSchema = new mongoose.Schema({ 
    survey: mongoose.Schema.Types.ObjectId,
    is_mentor: Boolean,
    role: String,
    answered: Boolean,
    answers: [{
        order: Number,
        qid: mongoose.Schema.Types.ObjectId,
        question: String,
        category: { type: String, enum: QuestionCategory },
        answer: mongoose.Schema.Types.Mixed
    }]
}, options);