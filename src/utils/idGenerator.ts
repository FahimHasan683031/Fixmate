import { Counter } from '../app/modules/counter/counter.model';

// Generates a formatted human-readable ID: FM-{PREFIX}-{000001}
export const generateCustomId = async (prefix: string): Promise<string> => {
  const counter = await Counter.findOneAndUpdate(
    { _id: prefix },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  const seq = counter.seq;
  const padded = String(seq).padStart(6, '0');
  return `FM-${prefix}-${padded}`;
};
