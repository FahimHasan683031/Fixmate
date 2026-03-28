// Terms&policy Service
import { TermsModel } from './terms&policy.model';

// Retrieve the current terms and conditions content
const getTerms = async () => {
  const result = await TermsModel.findOne({ type: 'terms' }).select('content -_id').lean().exec();
  return result;
};

// Retrieve the current privacy policy content
const getPolicy = async () => {
  const result = await TermsModel.findOne({ type: 'policy' }).select('content -_id').lean().exec();
  return result;
};

// Create or update the terms and conditions content
const upsertTerms = async (content: string) => {
  const result = await TermsModel.findOneAndUpdate(
    { type: 'terms' },
    { content, type: 'terms' },
    { upsert: true, new: true },
  )
    .lean()
    .exec();
  return result;
};

// Create or update the privacy policy content
const upsertPolicy = async (content: string) => {
  const result = await TermsModel.findOneAndUpdate(
    { type: 'policy' },
    { content, type: 'policy' },
    { upsert: true, new: true },
  )
    .lean()
    .exec();
  return result;
};

export const TermsAndPolicyService = {
  getTerms,
  getPolicy,
  upsertTerms,
  upsertPolicy,
};
