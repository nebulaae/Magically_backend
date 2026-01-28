import db from '../config/database';
import { User } from '../../src/user/models/User';
import { Publication } from '../../src/publication/models/Publication';
import { Comment } from '../../src/comment/models/Comment';
import { Subscription } from '../../src/user/models/Subscription';
import { LikedPublication } from '../../src/publication/models/LikedPublication';
import { LikedComment } from '../../src/comment/models/LikedComment';
import { setupAssociations } from '../models/associations';
import logger from '../utils/logger';

export const seedTestData = async () => {
  try {
    logger.info('Starting seed...');

    // Create 10 users
    const users = [];
    for (let i = 1; i <= 10; i++) {
      const user = await User.create({
        fullname: `Test User ${i}`,
        username: `testuser${i}`,
        email: `testuser${i}@example.com`,
        password: 'password123',
        verified: true,
        bio: `I am test user number ${i}`,
        tokens: 500,
        dailyActions: {
          count: 0,
          lastReset: new Date(),
        },
      });
      users.push(user);
      logger.info(`Created user: ${user.username}`);
    }

    // Create subscriptions (each user follows 3-5 random other users)
    for (const user of users) {
      const numToFollow = Math.floor(Math.random() * 3) + 3; // 3 to 5
      const otherUsers = users.filter((u) => u.id !== user.id);
      const shuffled = otherUsers.sort(() => 0.5 - Math.random());
      const toFollow = shuffled.slice(0, numToFollow);

      for (const followUser of toFollow) {
        await Subscription.create({
          followerId: user.id,
          followingId: followUser.id,
        });
      }
    }

    logger.info('Created subscriptions');

    // Create 10 publications for each user
    const publications = [];
    const publicationTexts = [
      'Beautiful sunset today! 🌅',
      'Just finished an amazing workout 💪',
      'Coffee time ☕️',
      'New project launch! 🚀',
      'Weekend vibes 🎉',
      'Coding all day 💻',
      'Nature walk 🌲',
      'Foodie life 🍕',
      'Travel memories ✈️',
      'Good vibes only ✨',
    ];

    for (const user of users) {
      for (let i = 0; i < 10; i++) {
        const pub = await Publication.create({
          userId: user.id,
          content: publicationTexts[i] + ` by ${user.username}`,
          imageUrl: '/images/gpt/12453395-b2e2-47fa-9091-7f1a58598142.png',
          likeCount: 0,
          commentCount: 0,
          category: 'General',
        });
        publications.push(pub);
      }
    }
    logger.info(`Created ${publications.length} publications`);

    // Create likes (each user likes 10-15 random publications)
    for (const user of users) {
      const numToLike = Math.floor(Math.random() * 6) + 10; // 10 to 15
      const otherPubs = publications.filter((p) => p.userId !== user.id);
      const shuffled = otherPubs.sort(() => 0.5 - Math.random());
      const toLike = shuffled.slice(0, numToLike);

      for (const pub of toLike) {
        await LikedPublication.create({
          userId: user.id,
          publicationId: pub.id,
        });
        await pub.increment('likeCount');
      }
    }
    logger.info('Created likes');

    // Create comments (2-3 comments per publication)
    const commentTexts = [
      'Great post!',
      'Love this! 😍',
      'Amazing!',
      'Totally agree!',
      'Thanks for sharing!',
      'So cool!',
      'Awesome content!',
      'Very inspiring!',
    ];

    for (const pub of publications) {
      const numComments = Math.floor(Math.random() * 2) + 2; // 2 to 3
      const shuffledUsers = users.sort(() => 0.5 - Math.random());

      for (let i = 0; i < numComments; i++) {
        const commenter = shuffledUsers[i];
        const comment = await Comment.create({
          userId: commenter.id,
          publicationId: pub.id,
          text: commentTexts[Math.floor(Math.random() * commentTexts.length)],
          likeCount: 0,
        });

        await pub.increment('commentCount');

        // Add likes to comments
        const numCommentLikes = Math.floor(Math.random() * 4); // 0 to 3
        const commentLikers = users
          .filter((u) => u.id !== commenter.id)
          .sort(() => 0.5 - Math.random())
          .slice(0, numCommentLikes);

        for (const liker of commentLikers) {
          await LikedComment.create({
            userId: liker.id,
            commentId: comment.id,
          });
          await comment.increment('likeCount');
        }
      }
    }
    logger.info('Created comments and comment likes');

    logger.info('✅ Seed completed successfully!');
    logger.info(`Created:
      - ${users.length} users
      - ${publications.length} publications
      - Subscriptions, likes, and comments`);
  } catch (error) {
    logger.error(`Seed error: ${error.message}`);
    console.error(error);
  }
};
