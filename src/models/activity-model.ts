import * as mongoose  from "mongoose";
import { SurveyResponseModel, SurveyResponseSchema, ImgStore, UserBriefModel, UserBriefSchema } from "./shared-model";

export type ActivityModel = mongoose.Document & {
    by: UserBriefModel,
    connection: string
};
export const TaskStatus = ["Not Started", "On Track", "At Risk", "Pending", "Completed"];
// Activity Schema
export const ActivitySchema = new mongoose.Schema({
    connection: mongoose.Schema.Types.ObjectId,
    by: UserBriefSchema
}, {
    timestamps : true
});
ActivitySchema.index({"connection": 1, "createdAt": -1}, {sparse: true});
const Activity = mongoose.model< ActivityModel >("Activity", ActivitySchema);
export default Activity;

const options = { discriminatorKey : "kind"};

export type ChatActivityModel = ActivityModel & {
    txt: string
};
export const ChatActivitySchema = new mongoose.Schema({
    txt: String
}, options);
export const ChatActivity =  Activity.discriminator<ChatActivityModel>("Chat", ChatActivitySchema);

export type ImgActivityModel = ActivityModel & {
    img_id: string,
    img_path: string,
    img_store: string
};
export const ImgActivitySchema = new mongoose.Schema({
    img_id: mongoose.Schema.Types.ObjectId,
    img_path: String,
    img_store: { type: String, enum: ImgStore }
}, options);
export const ImgActivity =  Activity.discriminator<ImgActivityModel>("Img", ImgActivitySchema);

export type CallActivityModel = ActivityModel & {
    secs: number
};
export const CallActivitySchema = new mongoose.Schema({
    secs: Number
}, options);
export const CallActivity =  Activity.discriminator<CallActivityModel>("Call", CallActivitySchema);

export type MeetingActivityModel = ActivityModel & {
    when: Date,
    where: string,
    category: string,
    agenda: string,
    response: [{
        from: UserBriefModel,
        time: Date,
        accepted: boolean
    }]
};
export const MeetingCategory = [ "Telephonic", "Face to Face", "Web Conference", "Conference", "Chat Session", "Ask Me Anything"];
export const MeetingActivitySchema = new mongoose.Schema({
    when: Date,
    where: String,
    category: { type: String, enum: MeetingCategory },
    agenda: String,
    response: [{
        from: UserBriefSchema,
        time: Date,
        accepted: Boolean
    }]
}, options);
export const MeetingActivity =  Activity.discriminator<MeetingActivityModel>("Meeting", MeetingActivitySchema);


export type IntroActivityModel = ActivityModel & {
    txt: string,
    linkedin: string,
    twitter: string,
    blog: string
};
export const IntroActivitySchema = new mongoose.Schema({
    txt: String,
    linkedin: String,
    twitter: String,
    blog: String
}, options);
export const IntroActivity =  Activity.discriminator<IntroActivityModel>("Intro", IntroActivitySchema);

export type TodoActivityModel = ActivityModel & {
    task: string,
    status: string,
    assigned: UserBriefModel
};
interface ITodoActivityModel extends mongoose.Model<TodoActivityModel> {
    getPendingTasks: (callback: Function) => any;
  }
export const TodoActivitySchema = new mongoose.Schema({
    task: String,
    status: { type: String, enum: TaskStatus },
    assigned: UserBriefSchema
}, options);
TodoActivitySchema.statics.getPendingTasks = (callback: Function) => {
    const query = {"status": "Pending"};
    TodoActivity.findOne(query, callback);
};
export const TodoActivity =  <ITodoActivityModel>Activity.discriminator<TodoActivityModel>("Todo", TodoActivitySchema);

export type GoalActivityModel = ActivityModel & {
    task: string,
    status: string,
    progress: [{
        percentile: number,
        on: Date
    }]
};
export const GoalActivitySchema = new mongoose.Schema({
    task: String,
    status: { type: String, enum: TaskStatus },
    progress: [{
        percentile: Number,
        on: Date
    }]
}, options);
export const GoalActivity =  Activity.discriminator<GoalActivityModel>("Goal", GoalActivitySchema);


export type ReviewActivityModel = ActivityModel & SurveyResponseModel & {
};
export const ReviewActivity =  Activity.discriminator<ReviewActivityModel>("Review", SurveyResponseSchema);

export type ProgramReviewActivityModel = ActivityModel & SurveyResponseModel & {
};
export const ProgramReviewActivity =  Activity.discriminator<ProgramReviewActivityModel>("ProgramReview", SurveyResponseSchema);

export type InterviewActivityModel = ActivityModel & SurveyResponseModel & {
};
export const InterviewActivity =  Activity.discriminator<InterviewActivityModel>("Interview", SurveyResponseSchema);

export type BizPlanActivityModel = ActivityModel & SurveyResponseModel & {
};
export const BizPlanActivity =  Activity.discriminator<BizPlanActivityModel>("BizPlan", SurveyResponseSchema);

export type PollActivityModel = ActivityModel & SurveyResponseModel & {
};
export const PollActivity =  Activity.discriminator<PollActivityModel>("Poll", SurveyResponseSchema);

//test start

// const chat= new ChatActivity({
//     connection: "connect 1",
//     text: "hey u"
// })
// chat.save((err: Error, savedChat: ChatActivityModel) => {
//     logger.debug("activity saved" + savedChat);
// });
// const todo= new TodoActivity({
//     connection: "connect 1",
//     task: "new goals set",
//     status: "Pending"
// }).save((err: Error, savedChat: TodoActivityModel) => {
//     logger.debug("activity saved" + savedChat);
// });
// const review= new ReviewActivity({
//     connection: "connect 1",
//     text: "nice program",
//     rating: 4.5
// }).save((err: Error, savedChat: ReviewActivityModel) => {
//     logger.debug("activity saved" + savedChat);
// });
// TodoActivity.getPendingTasks(( err:Error, existingTasks: TodoActivityModel[] ) => {
//     logger.debug("Activities Found", existingTasks);
// });
// Activity.find({}, (err:any, activities: ActivityModel[]) => {
//     console.log(activities);
//     activities.forEach((activity: any) => {
//         let act;
//         if(activity["__t"] == "Chat"){
//             act= <ChatActivityModel> activity;
//             logger.debug(activity.text);
//         } else if(activity["__t"] == "Todo"){
//             act= <TodoActivityModel> activity;
//             logger.debug(act.task+ " : " + act.status);
//         } else {
//             act= <ReviewActivityModel> activity;
//             logger.debug(act.text+ " : " + act.rating);
//         }
//     })
// });

//test end
