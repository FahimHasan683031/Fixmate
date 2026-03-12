import { Types } from "mongoose";
import { StatusCodes } from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";

import ApiError from "../../../errors/ApiError";
import { Chat } from "./chat.model";
import { Message } from "../message/message.model";
import { IPaginationOptions } from "../../../interfaces/pagination";
import QueryBuilder from "../../builder/QueryBuilder";

const create = async (payload: JwtPayload, data: { user: string }) => {
    const chat = await Chat.findOne({
        participants: { $all: [new Types.ObjectId(payload.authId), new Types.ObjectId(data.user)] }
    }).lean().exec();

    if (chat) return chat;

    return Chat.create({ participants: [payload.authId, data.user] });
};

const getById = async (id: string, payload: JwtPayload) => {
    const result = await Chat.findById(new Types.ObjectId(id))
        .select("-createdAt -updatedAt -__v")
        .populate("participants", "name image")
        .lean().exec();

    if (!result) throw new ApiError(StatusCodes.NOT_FOUND, "Chat not found!");

    return {
        _id: result._id,
        chatWith: result.participants.find((participant: any) => participant._id.toString() !== payload.authId),
    };
};

const allChats = async (payload: JwtPayload, query: Partial<IPaginationOptions>) => {
    const id = new Types.ObjectId(payload.authId);

    const chatQuery = new QueryBuilder(
        Chat.find({ participants: id })
            .populate("participants", "name image whatsApp")
            .populate({
                path: "lastMessage",
                select: "sender message isSeen createdAt",
                populate: {
                    path: "sender",
                    select: "name image"
                }
            })
            .select("-createdAt -updatedAt -__v"),
        query as Record<string, unknown>
    )
        .filter()
        .sort()
        .paginate()
        .fields();

    const result = await chatQuery.modelQuery.lean().exec();
    const meta = await chatQuery.getPaginationInfo();

    const data = result.map((c: any) => ({
        ...c,
        participants: c.participants.filter((u: any) => u._id.toString() !== id.toString())
    }));

    return { meta, data };
};

const deleteOneChat = async (payload: JwtPayload, id: string) => {
    const chat = await Chat.findById(new Types.ObjectId(id)).lean().exec();
    if (!chat) throw new ApiError(StatusCodes.NOT_FOUND, "Chat not found!");

    const isParticipant = chat.participants.some((participant) => participant.toString() === payload.authId);
    if (!isParticipant) throw new ApiError(StatusCodes.UNAUTHORIZED, "You are not a participant of this chat!");

    const deletedChat = await Chat.findByIdAndDelete(id).lean().exec();
    if (deletedChat) {
        await Message.deleteMany({ chatId: deletedChat._id });
    }

    return deletedChat;
};

const findChat = async (user: JwtPayload, name: string) => {
    const userId = new Types.ObjectId(user.authId);
    const chats = await Chat.aggregate([
        {
            $lookup: {
                from: "users",
                localField: "participants",
                foreignField: "_id",
                as: "participants"
            }
        },
        {
            $lookup: {
                from: "messages",
                localField: "lastMessage",
                foreignField: "_id",
                as: "lastMessage"
            }
        },
        { $unwind: { path: "$lastMessage", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "users",
                localField: "lastMessage.sender",
                foreignField: "_id",
                as: "lastMessage.sender"
            }
        },
        { $unwind: { path: "$lastMessage.sender", preserveNullAndEmptyArrays: true } },
        {
            $match: {
                "participants.name": { $regex: name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" },
                participants: { $elemMatch: { _id: { $ne: userId } } }
            }
        },
        {
            $project: {
                _id: 1,
                participants: {
                    $map: {
                        input: "$participants",
                        as: "p",
                        in: { _id: "$$p._id", name: "$$p.name", image: "$$p.image" }
                    }
                },
                lastMessage: {
                    _id: "$lastMessage._id",
                    sender: {
                        _id: "$lastMessage.sender._id",
                        name: "$lastMessage.sender.name",
                        image: "$lastMessage.sender.image"
                    },
                    message: "$lastMessage.message",
                    isSeen: "$lastMessage.isSeen",
                    createdAt: "$lastMessage.createdAt"
                }
            }
        },
        { $sort: { "lastMessage.createdAt": -1 } },
    ]);

    return chats;
};

export const ChatServices = {
    create,
    getById,
    allChats,
    deleteOneChat,
    findChat
};
