// Message Service
import { JwtPayload } from 'jsonwebtoken';
import { IPaginationOptions } from '../../../interfaces/pagination';
import { IMessage } from './message.interface';
import ApiError from '../../../errors/ApiError';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import { PushNotificationService } from '../notification/pushNotification.service';
import { Chat } from '../chat/chat.model';
import { Message } from './message.model';
import { User } from '../user/user.model';
import QueryBuilder from '../../builder/QueryBuilder';

// Create and send a new message within a chat room, triggering push and socket notifications
const create = async (user: JwtPayload, payload: Partial<IMessage>) => {
  if (!payload.message && !payload.image) {
    throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'You must give at last one message');
  }

  const chat = await Chat.findById(new Types.ObjectId(payload.chatId)).lean().exec();
  if (!chat) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Chat not found');
  }

  payload.sender = new Types.ObjectId(user.authId);
  const message = await (await Message.create(payload)).populate('sender', 'name image');

  await Chat.updateOne(
    { _id: new Types.ObjectId(payload.chatId) },
    { lastMessage: new Types.ObjectId(message._id) },
  );

  const reciver = chat.participants.find(p => p.toString() !== user.authId);
  if (reciver) {
    const customer = await User.findById(new Types.ObjectId(reciver));
    if (customer && customer.fcmToken) {
      await PushNotificationService.sendPushNotification(
        customer.fcmToken,
        'Got message',
        'You have a new message',
      );
    }
  }

  const socket = global.io;
  if (socket) {
    socket.emit(`new-message::${payload.chatId}`, message);
    socket.emit(`update-chatlist::${user.authId}`);
    if (reciver) {
      socket.emit(`update-chatlist::${reciver}`);
    }
  }

  return message;
};

// Update the content or status of an existing message sent by the user
const updateMessage = async (user: JwtPayload, id: string, payload: Partial<IMessage>) => {
  const result = await Message.findOneAndUpdate(
    { sender: new Types.ObjectId(user.authId), _id: new Types.ObjectId(id) },
    payload,
    { new: true },
  )
    .lean()
    .exec();

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Message not found');
  }

  const socket = global.io;
  if (socket) {
    socket.emit(`update-message::${result.chatId}`, result);
    const chat = await Chat.findById(result.chatId).lean().exec();
    if (chat) {
      chat.participants.forEach(participant => {
        socket.emit(`update-chatlist::${participant}`);
      });
    }
  }

  return 1;
};

// Retrieve all messages for a specific chat room with pagination and recipient info
const messagesOfChat = async (user: JwtPayload, query: IPaginationOptions, chatId: string) => {
  const chat = await Chat.findById(chatId)
    .populate<{ participants: any[] }>('participants', 'name image whatsApp')
    .lean();

  if (!chat) throw new ApiError(StatusCodes.NOT_FOUND, 'Requested chat not found.');

  let otherParticipant = null;
  if (Array.isArray(chat.participants)) {
    otherParticipant = chat.participants.find(p => p._id.toString() !== user.authId.toString());
  }

  const otherParticipantWhatsApp = otherParticipant?.whatsApp || '';

  const messageQuery = new QueryBuilder(
    Message.find({
      chatId: new Types.ObjectId(chatId),
    })
      .populate({
        path: 'sender',
        select: 'name image whatsApp contact',
      })
      .select('-chatId'),
    query as Record<string, unknown>,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await messageQuery.modelQuery.lean().exec();
  const meta = await messageQuery.getPaginationInfo();

  return {
    meta,
    otherParticipantWhatsApp: otherParticipantWhatsApp,
    data,
  };
};

// Delete a specific message sent by the user
const deleteMessage = async (user: JwtPayload, id: string) => {
  const result = await Message.deleteOne({
    sender: new Types.ObjectId(user.authId),
    _id: new Types.ObjectId(id),
  })
    .lean()
    .exec();

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
