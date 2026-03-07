import { Types } from 'mongoose'

export interface IReview {
  _id?: Types.ObjectId
  name: string
  email: string
  rating: number
  comment?: string
}
