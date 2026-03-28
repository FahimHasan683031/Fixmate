import { Counter } from '../app/modules/counter/counter.model';

// Generates a checksum letter (A-Z) based on the digit sum of the counter
const getChecksum = (num: number): string => {
  const digits = num
    .toString()
    .split('')
    .reduce((sum, d) => sum + parseInt(d), 0);
  return String.fromCharCode(65 + (digits % 26));
};

// Generates a formatted human-readable ID: FM-{PREFIX}-{000001}-{A}
export const generateCustomId = async (prefix: string): Promise<string> => {
  const counter = await Counter.findOneAndUpdate(
    { _id: prefix },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  const seq = counter.seq;
  const padded = String(seq).padStart(6, '0');
  const checksum = getChecksum(seq);
  return `FM-${prefix}-${padded}-${checksum}`;
};
