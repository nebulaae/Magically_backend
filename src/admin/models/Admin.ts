import db from '../../../shared/config/database';
import bcrypt from 'bcrypt';
import { Model, DataTypes, HasManyGetAssociationsMixin } from 'sequelize';
import type { Publication } from '../../publication/models/Publication';

export interface AdminAttributes {
  id: string;
  fullname: string;
  username: string;
  email: string;
  password?: string;
  avatar?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Admin extends Model<AdminAttributes> implements AdminAttributes {
  public id!: string;
  public fullname!: string;
  public username!: string;
  public email!: string;
  public password!: string;
  public avatar?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public getPublications!: HasManyGetAssociationsMixin<Publication>;

  public async comparePassword(candidatePassword: string): Promise<boolean> {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
  }
}

Admin.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    fullname: { type: DataTypes.STRING, allowNull: false },
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    avatar: { type: DataTypes.STRING, allowNull: true },
  },
  {
    sequelize: db,
    modelName: 'Admin',
    tableName: 'Admins',
    hooks: {
      beforeCreate: async (admin: Admin) => {
        if (admin.password) {
          admin.password = await bcrypt.hash(admin.password, 10);
        }
      },
      beforeUpdate: async (admin: Admin) => {
        if (admin.changed('password') && admin.password) {
          admin.password = await bcrypt.hash(admin.password, 10);
        }
      },
    },
  }
);
