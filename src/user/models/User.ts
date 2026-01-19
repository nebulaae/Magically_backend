import bcrypt from "bcrypt";
import db from "../../../shared/config/database";
import type { Comment } from "../../comment/models/Comment";
import { ReplicateStatus } from "../../../shared/types/types";
import type { Publication } from "../../publication/models/Publication";
import {
  Model,
  DataTypes,
  HasManyGetAssociationsMixin,
  BelongsToManyAddAssociationMixin,
  BelongsToManyRemoveAssociationMixin,
  BelongsToManyGetAssociationsMixin,
} from "sequelize";

// --- User Model Attributes ---
export interface UserAttributes {
  id: string;
  fullname?: string;
  username?: string;
  email: string;
  bio?: string;
  password?: string;
  avatar?: string;
  interests?: string[];
  tokens: number;
  dailyActions: {
    count: number;
    lastReset: Date;
  };
  role: "user" | "admin";
  isBlocked: boolean;
  verified: boolean;
  telegramId?: string;
  otp?: string;
  otpExpires?: Date;
  passwordResetToken?: string;
  passwordResetTokenExpires?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// --- User Model Class ---
export class User extends Model<UserAttributes> implements UserAttributes {
  public id!: string;
  public fullname!: string;
  public username!: string;
  public email!: string;
  public bio?: string;
  public password!: string;
  public avatar?: string;
  public interests?: string[];
  public tokens!: number;
  public dailyActions!: {
    count: number;
    lastReset: Date;
  };
  public role!: "user" | "admin";
  public isBlocked!: boolean;
  public verified!: boolean;
  public telegramId?: string;
  public otp?: string;
  public otpExpires?: Date;
  public passwordResetToken?: string;
  public passwordResetTokenExpires?: Date;
  public replicateModels?: {
    id: string;
    version: string;
    name: string;
    status: ReplicateStatus; // Using the corrected type here
  }[];
  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public async comparePassword(candidatePassword: string): Promise<boolean> {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
  }

  // --- Sequelize Mixins for Associations ---
  public getPublications!: HasManyGetAssociationsMixin<Publication>;
  // Following/Followers
  public getFollowing!: BelongsToManyGetAssociationsMixin<User>;
  public addFollowing!: BelongsToManyAddAssociationMixin<User, string>;
  public removeFollowing!: BelongsToManyRemoveAssociationMixin<User, string>;
  public getFollowers!: BelongsToManyGetAssociationsMixin<User>;
  // Liked Publications
  public getLikedPublications!: BelongsToManyGetAssociationsMixin<Publication>;
  public addLikedPublication!: BelongsToManyAddAssociationMixin<
    Publication,
    string
  >;
  public removeLikedPublication!: BelongsToManyRemoveAssociationMixin<
    Publication,
    string
  >;
  // Liked Comments
  public getLikedComments!: BelongsToManyGetAssociationsMixin<Comment>;
  public addLikedComment!: BelongsToManyAddAssociationMixin<Comment, string>;
  public removeLikedComment!: BelongsToManyRemoveAssociationMixin<
    Comment,
    string
  >;
}

// --- Initialize User Model ---
User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    fullname: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    username: {
      type: DataTypes.STRING(32),
      allowNull: true,
      unique: true,
    },
    email: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    bio: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    password: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    avatar: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    interests: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
    },
    tokens: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 50,
    },
    dailyActions: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: { count: 0, lastReset: new Date() },
    },
    role: {
      type: DataTypes.ENUM("user", "admin"),
      defaultValue: "user",
      allowNull: false,
    },
    isBlocked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    telegramId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    otp: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    otpExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    passwordResetToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    passwordResetTokenExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    modelName: "User",
    tableName: "users",
    hooks: {
      beforeCreate: async (user: User) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user: User) => {
        if (user.changed("password") && user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
    },
  },
);