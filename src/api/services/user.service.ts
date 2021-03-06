import { omit } from 'lodash';
import { DocumentDefinition, FilterQuery } from 'mongoose';
import { UserDocument, UserModel } from '../models/user.model';

export const checkExistingUserService = async (
  { email, password, name }: DocumentDefinition<Omit<UserDocument, 'createdAt' | 'updatedAt' | 'comparePassword'>>
) => {
  const existingUser = await UserModel.findOne({ email });
  return existingUser;
}

export const createUserService = async (
  { email, password, name }: DocumentDefinition<Omit<UserDocument, 'createdAt' | 'updatedAt' | 'comparePassword'>>
) => {
  const query = await UserModel.create({
    email,
    password,
    name
  });
  return query;
}

export const validatePasswordService = async ({ email, password }: { email: string; password: string }) => {
  const user = await UserModel.findOne({ email });

  if (!user) return false;

  const isValid = await user.comparePassword(password);

  if (!isValid) return false;

  return omit(user.toJSON(), 'password');
}

export const findUserService = (query: FilterQuery<UserDocument>) => {
  return UserModel.findOne(query).lean();
}