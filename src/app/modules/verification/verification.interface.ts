import { Types } from "mongoose";
import { VERIFICATION_STATUS } from "../../../enum/user";

export interface IVerificaiton {
    user: Types.ObjectId;
    status: VERIFICATION_STATUS;
    nid: string;
    nidFront: string;
    nidBack: string;
    license: string;
}
