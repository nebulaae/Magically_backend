import db from '../../../shared/config/database';
import {
  Model,
  DataTypes,
  BelongsToGetAssociationMixin,
  HasManyGetAssociationsMixin,
  HasManyAddAssociationMixin,
  BelongsToManyGetAssociationsMixin,
  BelongsToManyAddAssociationMixin,
  BelongsToManyRemoveAssociationMixin,
} from 'sequelize';
import type { User } from '../../user/models/User';
import type { Publication } from '../../publication/models/Publication';

// --- Comment Model Attributes ---
export interface CommentAttributes {
  id: string;
  text: string;
  userId: string;
  publicationId: string;
  parentId?: string;
  likeCount: number;
  createdAt?: Date;
  updatedAt?: Date;
  // Virtual attribute set at runtime to indicate if current user liked the comment
  isLiked?: boolean;
}

// --- Comment Model Class ---
export class Comment
  extends Model<CommentAttributes>
  implements CommentAttributes
{
  public id!: string;
  public text!: string;
  public userId!: string;
  public publicationId!: string;
  public parentId?: string;
  public likeCount!: number;

  // Virtual flag — not persisted in DB. Will be set by service when fetching per-user.
  public isLiked?: boolean;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // --- Sequelize Mixins for Associations ---
  public getAuthor!: BelongsToGetAssociationMixin<User>;
  public getPublication!: BelongsToGetAssociationMixin<Publication>;
  public getParent!: BelongsToGetAssociationMixin<Comment>;
  public getReplies!: HasManyGetAssociationsMixin<Comment>;
  public addReply!: HasManyAddAssociationMixin<Comment, string>;

  // For likes
  public getLikers!: BelongsToManyGetAssociationsMixin<User>;
  public addLiker!: BelongsToManyAddAssociationMixin<User, string>;
  public removeLiker!: BelongsToManyRemoveAssociationMixin<User, string>;
}

// --- Initialize Comment Model ---
Comment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    publicationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'publications',
        key: 'id',
      },
    },
    parentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'comments', // Self-reference for replies
        key: 'id',
      },
    },
    likeCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    isLiked: {
      // virtual boolean field populated at runtime (not stored in DB)
      type: DataTypes.VIRTUAL(DataTypes.BOOLEAN),
      get(this: any) {
        // allow explicit setDataValue / dataValues overlay
        if (
          this &&
          this.dataValues &&
          Object.prototype.hasOwnProperty.call(this.dataValues, 'isLiked')
        ) {
          return this.dataValues.isLiked;
        }
        return false;
      },
      set(this: any, val: boolean) {
        if (!this.dataValues) this.dataValues = {};
        this.dataValues.isLiked = !!val;
      },
    },
  },
  {
    sequelize: db,
    modelName: 'Comment',
    tableName: 'comments',
  }
);
