import { JwtPayload } from 'jsonwebtoken';
import { IPaginationOptions } from '../../../interfaces/pagination';
import { IMessage } from './message.interface';
import ApiError from '../../../errors/ApiError';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import { emailQueue } from '../../../queues/email.queue';
import { redisDB } from '../../../redis/connectedUsers';
import { Chat } from '../chat/chat.model';
import { Message } from './message.model';
import { User } from '../user/user.model';
import { paginationHelper } from '../../../helpers/paginationHelper';

const create = async (user: JwtPayload, payload: Partial<IMessage>) => {
  if (!payload.message && !payload.image) {
    throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'You must give at last one message');
  }

  const chat = await Chat.findById(new Types.ObjectId(payload.chatId)).lean().exec();
  if (!chat) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Chat not found');
  }

  payload.sender = new Types.ObjectId(user.id);
  const message = await (await Message.create(payload)).populate("sender", "name image");

  await Chat.updateOne(
    { _id: new Types.ObjectId(payload.chatId) },
    { lastMessage: new Types.ObjectId(message._id) }
  );

  const isCustomerOnline = await redisDB.get(`user:${user.id}`);
  if (!isCustomerOnline) {
    const customerId = chat.participants.find(p => p.toString() !== user.id);
    if (customerId) {
      const customer = await User.findById(new Types.ObjectId(customerId));
      if (customer && customer.fcmToken) {
        await emailQueue.add(
          'push-notification',
          {
            notification: {
              title: 'Got message',
              body: 'You have a new message',
            },
            token: customer.fcmToken,
          },
          {
            removeOnComplete: true,
            removeOnFail: false,
          }
        );
      }
    }
  }

  //@ts-ignore
  const socket = global.io;
  if (socket) {
    chat.participants.forEach(async element => {
      const socketId = await redisDB.get(`user:${element}`);
      if (socketId) {
        socket.to(socketId).emit('message', message);
      }
    });
  }

  return message;
};

const updateMessage = async (user: JwtPayload, id: string, payload: Partial<IMessage>) => {
  const result = await Message.updateOne(
    { sender: new Types.ObjectId(user.id), _id: new Types.ObjectId(id) },
    payload
  ).lean().exec();

  if (!result.modifiedCount) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Message not found');
  }
  return result.modifiedCount;
};

const messagesOfChat = async (user: JwtPayload, query: IPaginationOptions, chatId: string) => {
  const chat = await Chat.findById(chatId)
    .populate<{ participants: any[] }>('participants', 'name image whatsApp')
    .lean();

  if (!chat)
    throw new ApiError(StatusCodes.NOT_FOUND, 'Requested chat not found.');

  let otherParticipant = null;
  if (Array.isArray(chat.participants)) {
    otherParticipant = chat.participants.find(
      p => p._id.toString() !== user.id.toString()
    );
  }

  const otherParticipantWhatsApp = otherParticipant?.whatsApp || '';

  const { skip, limit, sortBy, sortOrder } = paginationHelper.calculatePagination(query);

  const messages = await Message.find({
    chatId: new Types.ObjectId(chatId),
  })
    .populate({
      path: 'sender',
      select: 'name image whatsApp contact',
    })
    .select('-chatId')
    .skip(skip)
    .limit(limit)
    .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
    .lean().exec();

  return {
    otherParticipantWhatsApp: otherParticipantWhatsApp,
    messages,
  };
};

const deleteMessage = async (user: JwtPayload, id: string) => {
  const result = await Message.deleteOne({
    sender: new Types.ObjectId(user.id),
    _id: new Types.ObjectId(id),
  }).lean().exec();

  if (!result.deletedCount) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Message not found');
  }
  return result;
};

export const MessageServices = {
  create,
  updateMessage,
  messagesOfChat,
  deleteMessage,
};
