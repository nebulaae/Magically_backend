import { Publication } from "../../publication/models/Publication";
import { Gallery } from "../../gallery/models/Gallery";

export const createPublication = (data: {
  userId: string;
  content: string;
  imageUrl: string;
  category: string;
}) => {
  return Publication.create(data);
};

export const createGalleryItem = (data: {
  userId: string;
  prompt: string;
  imageUrl: string;
  generationType: string;
}) => {
  return Gallery.create(data);
};
