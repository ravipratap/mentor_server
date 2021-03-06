import { UserModel } from "../models/user-model";
const transformProps = require('transform-props');

function castToString(arg:any) {
    return String(arg);
}
export let convertUsertoString =(savedUser: any) => {
    if(savedUser){
        let docObj= savedUser.toObject();
        transformProps(docObj, castToString, ['_id', 'qid', 'img_id', 'program', 'survey', 'site', 'forUser']);
        return docObj;
    } else {
        return savedUser;
    }
};



export let JSONflatten = (data:any) => {
    let result:any = {};
    function recurse (cur:any, prop:string) {
        if (Object(cur) !== cur) {
            result[prop] = cur;
        } else if (Array.isArray(cur)) {
            let l=cur.length;
             for(let i=0; i<l; i++)
                 recurse(cur[i], prop ? prop+"."+i : ""+i);
            if (l == 0)
                result[prop] = [];
        } else {
            let isEmpty = true;
            for (let p in cur) {
                isEmpty = false;
                recurse(cur[p], prop ? prop+"."+p : p);
            }
            if (isEmpty)
                result[prop] = {};
        }
    }
    recurse(data, "");
    return result;
};
export let JSONunflatten = (data:any) => {
    if (Object(data) !== data || Array.isArray(data))
        return data;
    let result:any = {}, cur, prop, parts, idx;
    for(let p in data) {
        cur = result, prop = "";
        parts = p.split(".");
        for(let i=0; i<parts.length; i++) {
            idx = !isNaN(parseInt(parts[i]));
            cur = cur[prop] || (cur[prop] = (idx ? [] : {}));
            prop = parts[i];
        }
        cur[prop] = data[p];
    }
    return result[""];
};