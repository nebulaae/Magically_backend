import db from "../../../shared/config/database";
import { Model, DataTypes } from "sequelize";

export interface GenerationJobAttributes {
  id: string;
  userId: string;
  service: "kling" | "higgsfield" | "gpt" | "nano" | "nano-pro" | "gpt-1.5" | "ttapi" | "flux";
  serviceTaskId: string;
  status: "pending" | "processing" | "completed" | "failed";
  resultUrl?: string;
  errorMessage?: string;
  meta: {
    prompt: string;
    publish: boolean;
    aspect_ratio?: string;
    model_type?: string;
    [key: string]: any;
  };
}

export class GenerationJob extends Model<GenerationJobAttributes> implements GenerationJobAttributes {
  public id!: string;
  public userId!: string;
  public service!: "kling" | "higgsfield" | "gpt" | "nano" | "nano-pro" | "gpt-1.5" | "ttapi" | "flux";
  public serviceTaskId!: string;
  public status!: "pending" | "processing" | "completed" | "failed";
  public resultUrl?: string;
  public errorMessage?: string;
  public meta!: any;
}

GenerationJob.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, references: { model: "users", key: "id" } },
    service: {
      type: DataTypes.ENUM("kling", "higgsfield", "gpt", "nano", "nano-pro", "gpt-1.5", "ttapi", "flux"),
      allowNull: false
    },
    serviceTaskId: { type: DataTypes.STRING, allowNull: false, unique: true },
    status: {
      type: DataTypes.ENUM("pending", "processing", "completed", "failed"),
      allowNull: false,
      defaultValue: "pending"
    },
    resultUrl: { type: DataTypes.STRING, allowNull: true },
    errorMessage: { type: DataTypes.TEXT, allowNull: true },
    meta: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  },
  { sequelize: db, modelName: "GenerationJob", tableName: "generation_jobs" }
);