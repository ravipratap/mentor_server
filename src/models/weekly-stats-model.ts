import * as mongoose  from "mongoose";
import { StatsCategory } from "./monthly-stats-model";


export type WeeklyStatsModel = mongoose.Document & {
    meta: {
        site: string,
        program: string,
        date: Date,
        category: string,
        platform: string
    },
    weekly: number
  };
 interface IWeeklyStatsModel extends mongoose.Model<WeeklyStatsModel> {
  }
// WeeklyStats Schema
const WeeklyStatsSchema = new mongoose.Schema({
    meta: {
        site: String,
        program: String,
        date: Date,
        category: {type: String, enum: StatsCategory},
        platform: String
    },
    weekly: Number
}, {
    timestamps : true
});

const WeeklyStats = mongoose.model< WeeklyStatsModel, IWeeklyStatsModel >("WeeklyStats", WeeklyStatsSchema);
export default WeeklyStats;

