import { model, Schema } from 'mongoose';
import { ISupport } from './support.interface';
import { SupportStatus } from '../../../enum/support';
import { generateCustomId } from '../../../utils/idGenerator';

const supportSchema = new Schema<ISupport>(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    attachment: {
      type: String,
      default: '',
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: Object.values(SupportStatus),
      default: SupportStatus.PENDING,
    },
    customId: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

supportSchema.pre('save', async function (next) {
  if (this.isNew && !this.customId) {
    this.customId = await generateCustomId('SPT');
  }
  next();
});

export const Support = model<ISupport>('Support', supportSchema);
