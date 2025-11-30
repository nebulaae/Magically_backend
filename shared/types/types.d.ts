export type ReplicateStatus =
    | "starting"
    | "processing"
    | "succeeded"
    | "failed"
    | "canceled";

export interface ReplicateModel {
    id: string;
    version: string | null;
    name: string;
    destination: string;
    status: ReplicateStatus;
    createdAt: string;
}

export interface TrainModelRequest {
    modelName: string;
    triggerWord: string;
    loraType?: "subject" | "style";
    steps?: number;
    loraRank?: number;
}

export interface GenerateImageRequest {
    modelDestination: string; // Format: "username/model-name"
    prompt: string;
    aspectRatio?: "1:1" | "16:9" | "21:9" | "3:2" | "2:3" | "4:5" | "5:4" | "3:4" | "4:3" | "9:16" | "9:21";
    numOutputs?: number; // 1-4
    guidanceScale?: number; // 0-10
    numInferenceSteps?: number; // 1-50
}