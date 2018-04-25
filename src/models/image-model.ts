import * as mongoose  from "mongoose";
import { ImgStore } from "./shared-model";

export type ImageModel = mongoose.Document & {
    filename: string,
    original_name: string,
    mime_type: string,
    img_path: string,
    height: number,
    width: number,
    bytes: number,
    store:  string,
    version: string,
    etag: string, //md5 signature unique
    thumbnail_path: string,
    by: string,
    for: string
  };
export const ImgType = ["profile", "program", "activity"];
// Image Schema
const ImageSchema = new mongoose.Schema({
    filename: String,
    original_name: String,
    mime_type: String,
    img_path: String,
    height: Number,
    width: Number,
    bytes: Number,
    store: {
        type: String,
        enum: ImgStore,
        default: "local"
    },
    version: String,
    etag: String,
    thumbnail_path: String,
    by: mongoose.Schema.Types.ObjectId,
    for: {type: String, enum: ImgType}
}, {
    timestamps : true
});

const Image =  mongoose.model< ImageModel >("Image", ImageSchema);
export default Image;



