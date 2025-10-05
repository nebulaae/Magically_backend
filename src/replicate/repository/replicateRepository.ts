import { User } from "../../user/models/User";
import { GenerationJob } from "../../publication/models/GenerationJob";
import { Transaction } from "sequelize";

export const findUserById = (userId: string, transaction: Transaction) => {
  return User.findByPk(userId, { transaction });
};

export const updateUser = (
  user: User,
  updates: Partial<User>,
  transaction: Transaction,
) => {
  Object.assign(user, updates);
  return user.save({ transaction });
};

export const createGenerationJob = (jobData: {
  userId: string;
  service: "replicate";
  serviceTaskId: string;
  status: "pending";
  prompt: string;
}) => {
  return GenerationJob.create(jobData);
};
