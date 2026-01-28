import crypto from 'crypto';
import bcrypt from 'bcrypt';

import { User } from '../../user/models/User';
import { logger } from 'sequelize/lib/utils/logger';
import { sendPasswordResetEmail } from '../../../shared/scripts/email';

export const createPasswordResetToken = async (user: User): Promise<string> => {
  const resetToken = crypto.randomBytes(32).toString('hex');

  user.passwordResetToken = await bcrypt.hash(resetToken, 10);
  user.passwordResetTokenExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await user.save();
  return resetToken;
};

export const handleForgotPassword = async (email: string) => {
  const user = await User.findOne({ where: { email, verified: true } });

  if (!user) {
    // Don't reveal that the user doesn't exist
    logger.error(
      'Password reset requested for non-existent or unverified email.'
    );
    return;
  }

  const resetToken = await createPasswordResetToken(user);
  await sendPasswordResetEmail(user.email, resetToken);
};
