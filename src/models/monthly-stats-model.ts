import * as mongoose  from "mongoose";
import { platform } from "os";


export type MonthlyStatsModel = mongoose.Document & {
    meta: {
        site: string,
        program: string,
        date: Date,
        category: string,
        platform: string
    },
    monthly: number,
    daily: any // {"1": 233, "2": .....}
  };
 interface IMonthlyStatsModel extends mongoose.Model<MonthlyStatsModel> {
  }
export const StatsCategory = ["Mentors", "Mentees", "Connections", "ClosedConnections", 
    "EOI", "Accepts", "Declines", "AcceptRequestTime", "AdminLogins", 
    "Logins", "ActiveConnection", "Messages", 
    "Introduced", "GoalsSet", "ActionPlan", "Meetings", 
    "TaskUpdates", "Chats", "Calls", "Feedback", 
    "SatisfactionRating", "MentorFeedback", "MentorSatisfactionRating", 
    "MenteeFeedback", "MenteeSatisfactionRating" ];
    
// MonthlyStats Schema
const MonthlyStatsSchema = new mongoose.Schema({
    meta: {
        site: String,
        program: String,
        date: Date,
        category: {type: String, enum: StatsCategory},
        platform: String
    },
    monthly: Number,
    daily: Object // {"1": 233, "2": .....}
}, {
    timestamps : true
});

const MonthlyStats = mongoose.model< MonthlyStatsModel, IMonthlyStatsModel >("MonthlyStats", MonthlyStatsSchema);
export default MonthlyStats;

