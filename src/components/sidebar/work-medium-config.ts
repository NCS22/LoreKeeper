import {
  BookImage,
  BookOpen,
  Clapperboard,
  File,
  MonitorPlay,
  Newspaper,
  Tv,
  type LucideIcon,
} from "lucide-react";
import type { WorkMediumDto } from "@/mocks/dto/work";

export const WORK_MEDIUM_ICONS: Record<WorkMediumDto, LucideIcon> = {
  NOVEL: BookOpen,
  MANGA: BookImage,
  COMIC: Newspaper,
  ANIME: MonitorPlay,
  TV_SERIES: Tv,
  FILM: Clapperboard,
  OTHER: File,
};
