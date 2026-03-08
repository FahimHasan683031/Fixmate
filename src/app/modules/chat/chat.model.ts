import { model, Schema } from 'mongoose';
import { ChatModel, IChat } from './chat.interface';

const chatSchema = new Schema<IChat, ChatModel>(
    {
        participants: [
            {
                type: Schema.Types.ObjectId,
                ref: 'User',
            }
        ],
        lastMessage: {
            type: Schema.Types.ObjectId,
            ref: 'Message'
        }
    },
    {
        timestamps: true
    }
)

export const Chat = model<IChat, ChatModel>('Chat', chatSchema);
