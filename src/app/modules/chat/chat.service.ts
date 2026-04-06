// Chat Service
import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import ApiError from '../../../errors/ApiError';
import { Chat } from './chat.model';
import { Message } from '../message/message.model';
import QueryBuilder from '../../builder/QueryBuilder';
import { User } from '../user/user.model';

// Initialize or retrieve an existing chat room between two users
const create = async (payload: JwtPayload, data: { user: string }) => {
  const chat = await Chat.findOne({
    participants: { $all: [new Types.ObjectId(payload.authId), new Types.ObjectId(data.user)] },
  })
    .lean()
    .exec();

  if (chat) return chat;

  return Chat.create({ participants: [payload.authId, data.user] });
};

// Retrieve chat room details by its ID, identifying the other participant
const getById = async (id: string, payload: JwtPayload) => {
  const result = await Chat.findById(new Types.ObjectId(id))
    .select('-createdAt -updatedAt -__v')
    .populate('participants', 'name image email')
    .lean()
    .exec();

  if (!result) throw new ApiError(StatusCodes.NOT_FOUND, 'We couldn\'t find the conversation you\'re looking for.');

  return {
    _id: result._id,
    chatWith: result.participants.find(
      (participant: any) => participant._id.toString() !== payload.authId,
    ),
  };
};

// Fetch all chat rooms for the current user with latest message preview
const allChats = async (payload: JwtPayload, query: any) => {
  const id = new Types.ObjectId(payload.authId);
  const { searchTerm, ...queryObj } = query;

  let filter: any = { participants: id };

  if (searchTerm) {
    const users = await User.find({
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
      ],
    }).select('_id');

    const userIds = users.map(u => u._id);

    filter = {
      $and: [{ participants: id }, { participants: { $in: userIds } }],
    };
  }

  const chatQuery = new QueryBuilder(
    Chat.find(filter)
      .populate('participants', 'name image email')
      .populate({
        path: 'lastMessage',
        select: 'sender message isSeen createdAt',
        populate: {
          path: 'sender',
          select: 'name image',
        },
      })
      .select('-createdAt -__v'),
    { ...queryObj, sort: '-updatedAt' },
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await chatQuery.modelQuery.lean().exec();
  const meta = await chatQuery.getPaginationInfo();

  const data = result.map((c: any) => ({
    ...c,
    participants: c.participants.filter((u: any) => u._id.toString() !== id.toString()),
  }));

  return { meta, data };
};

// Delete a chat room and all its associated messages
const deleteOneChat = async (payload: JwtPayload, id: string) => {
  const chat = await Chat.findById(new Types.ObjectId(id)).lean().exec();
  if (!chat) throw new ApiError(StatusCodes.NOT_FOUND, 'We couldn\'t find the conversation you\'re trying to delete.');

  const isParticipant = chat.participants.some(
    participant => participant.toString() === payload.authId,
  );
  if (!isParticipant)
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'You don\'t have access to this conversation.');

  const deletedChat = await Chat.findByIdAndDelete(id).lean().exec();
  if (deletedChat) {
    await Message.deleteMany({ chatId: deletedChat._id });
  }

  return deletedChat;
};

export const ChatServices = {
  create,
  getById,
  allChats,
  deleteOneChat,
};
