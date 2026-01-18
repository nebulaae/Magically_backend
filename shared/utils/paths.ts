import path from "path";

export const PROJECT_ROOT = process.cwd();

export const PUBLIC_ROOT = path.join(PROJECT_ROOT, "public");

export const fromPublic = (urlPath: string): string => {
  return path.join(
    PUBLIC_ROOT,
    urlPath.replace(/^\/+/, "")
  );
};

export const publicDir = (...segments: string[]): string => {
  return path.join(PUBLIC_ROOT, ...segments);
};
