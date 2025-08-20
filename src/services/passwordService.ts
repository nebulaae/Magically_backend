import crypto from 'crypto';
import bcrypt from 'bcrypt';

import { User } from '../models/User';
import { sendPasswordResetEmail } from './emailService';

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
        console.log("Password reset requested for non-existent or unverified email.");
        return;
    }

    const resetToken = await createPasswordResetToken(user);
    await sendPasswordResetEmail(user.email, resetToken);
};