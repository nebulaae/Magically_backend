import logger from "../utils/logger";
import { User } from "../../src/user/models/User";
import { Gallery } from "../../src/gallery/models/Gallery";
import { Comment } from "../../src/comment/models/Comment";
import { Publication } from "../../src/publication/models/Publication";
import { LikedComment } from "../../src/comment/models/LikedComment";
import { Subscription } from "../../src/user/models/Subscription";
import { GenerationJob } from "../../src/publication/models/GenerationJob";
import { LikedPublication } from "../../src/publication/models/LikedPublication";

export const setupAssociations = () => {
  // User -> Publication (One-to-Many)
  User.hasMany(Publication, {
    foreignKey: "userId",
    as: "publications",
    onDelete: "CASCADE",
  });
  Publication.belongsTo(User, {
    foreignKey: "userId",
    as: "author",
  });

  // User <-> User (Many-to-Many through Subscription for followers/following)
  User.belongsToMany(User, {
    as: "Followers",
    through: Subscription,
    foreignKey: "followingId",
    otherKey: "followerId",
  });
  User.belongsToMany(User, {
    as: "Following",
    through: Subscription,
    foreignKey: "followerId",
    otherKey: "followingId",
  });

  // User <-> Publication (Many-to-Many through LikedPublication for likes)
  User.belongsToMany(Publication, {
    as: "likedPublications",
    through: LikedPublication,
    foreignKey: "userId",
    otherKey: "publicationId",
  });
  Publication.belongsToMany(User, {
    as: "likers",
    through: LikedPublication,
    foreignKey: "publicationId",
    otherKey: "userId",
  });

  // User -> Comment (One-to-Many)
  User.hasMany(Comment, {
    foreignKey: "userId",
    as: "comments",
    onDelete: "CASCADE",
  });
  Comment.belongsTo(User, {
    foreignKey: "userId",
    as: "author",
  });

  // Publication -> Comment (One-to-Many)
  Publication.hasMany(Comment, {
    foreignKey: "publicationId",
    as: "comments",
    onDelete: "CASCADE",
  });
  Comment.belongsTo(Publication, {
    foreignKey: "publicationId",
    as: "publication",
  });

  // Comment -> Comment (Self-referencing for replies)
  Comment.hasMany(Comment, {
    foreignKey: "parentId",
    as: "replies",
    onDelete: "CASCADE",
  });
  Comment.belongsTo(Comment, {
    foreignKey: "parentId",
    as: "parent",
  });

  // User <-> Comment (Many-to-Many for likes on comments)
  User.belongsToMany(Comment, {
    as: "likedComments",
    through: LikedComment,
    foreignKey: "userId",
    otherKey: "commentId",
  });
  Comment.belongsToMany(User, {
    as: "likers",
    through: LikedComment,
    foreignKey: "commentId",
    otherKey: "userId",
  });

  // User -> Gallery (One-to-Many)
  User.hasMany(Gallery, {
    foreignKey: "userId",
    as: "galleryItems",
    onDelete: "CASCADE",
  });
  Gallery.belongsTo(User, {
    foreignKey: "userId",
    as: "user",
  });

  // User -> VideoJob (One-to-Many)
  User.hasMany(GenerationJob, {
    foreignKey: "userId",
    as: "videoJobs",
    onDelete: "CASCADE",
  });
  GenerationJob.belongsTo(User, {
    foreignKey: "userId",
    as: "user",
  });

  logger.info("Database associations have been set up.");
};
