import { ANIME_WORK_ID, NOVEL_WORK_ID, TIDEWRACK_WORK_ID } from "@/mocks/data/works";
import { EMBER_UNIVERSE_ID, TIDEWRACK_UNIVERSE_ID } from "@/mocks/data/universes";
import type { SourceDto } from "@/mocks/dto/source";

export const SOURCE_IDS = {
  novelPrologue: "source-novel-prologue",
  novelVolume1Chapter1: "source-novel-v1c1",
  novelVolume1Chapter3: "source-novel-v1c3",
  novelVolume1Chapter4: "source-novel-v1c4",
  novelVolume2Chapter3: "source-novel-v2c3",
  novelVolume3Chapter1: "source-novel-v3c1",
  novelVolume3Chapter2: "source-novel-v3c2",
  animeEpisode5: "source-anime-ep5",
  authorAfterword: "source-afterword-volume-2",
  readingNotes: "source-reading-notes",
  authorInterview: "source-author-interview",
  saltLedgerChapter2: "source-salt-ledger-ch2",
} as const;

function novelChapterSource(id: string, unitNumber: number, title: string): SourceDto {
  return {
    id,
    universeId: EMBER_UNIVERSE_ID,
    type: "WORK_UNIT",
    workId: NOVEL_WORK_ID,
    narrativeUnitId: `${NOVEL_WORK_ID}-unit-${unitNumber}`,
    title,
    reference: null,
  };
}

export const SOURCES: readonly SourceDto[] = [
  novelChapterSource(SOURCE_IDS.novelPrologue, 1, "Ashes of the Concordat, Prologue"),
  novelChapterSource(SOURCE_IDS.novelVolume1Chapter1, 2, "Ashes of the Concordat, Vol. 1, Ch. 1"),
  novelChapterSource(SOURCE_IDS.novelVolume1Chapter3, 4, "Ashes of the Concordat, Vol. 1, Ch. 3"),
  novelChapterSource(SOURCE_IDS.novelVolume1Chapter4, 5, "Ashes of the Concordat, Vol. 1, Ch. 4"),
  novelChapterSource(SOURCE_IDS.novelVolume2Chapter3, 10, "Ashes of the Concordat, Vol. 2, Ch. 3"),
  novelChapterSource(SOURCE_IDS.novelVolume3Chapter1, 14, "Ashes of the Concordat, Vol. 3, Ch. 1"),
  novelChapterSource(SOURCE_IDS.novelVolume3Chapter2, 15, "Ashes of the Concordat, Vol. 3, Ch. 2"),
  {
    id: SOURCE_IDS.animeEpisode5,
    universeId: EMBER_UNIVERSE_ID,
    type: "WORK_UNIT",
    workId: ANIME_WORK_ID,
    narrativeUnitId: `${ANIME_WORK_ID}-unit-5`,
    title: "Ashes of the Concordat: The Animation, Ep. 5",
    reference: null,
  },
  {
    id: SOURCE_IDS.authorAfterword,
    universeId: EMBER_UNIVERSE_ID,
    type: "SUPPLEMENTARY",
    workId: null,
    narrativeUnitId: null,
    title: "Author afterword, Volume 2",
    reference: null,
  },
  {
    id: SOURCE_IDS.readingNotes,
    universeId: EMBER_UNIVERSE_ID,
    type: "USER_NOTE",
    workId: null,
    narrativeUnitId: null,
    title: "My reading notes",
    reference: null,
  },
  {
    id: SOURCE_IDS.authorInterview,
    universeId: EMBER_UNIVERSE_ID,
    type: "EXTERNAL",
    workId: null,
    narrativeUnitId: null,
    title: "Author interview, anime season announcement",
    reference: "Interview transcript, spring issue",
  },
  {
    id: SOURCE_IDS.saltLedgerChapter2,
    universeId: TIDEWRACK_UNIVERSE_ID,
    type: "WORK_UNIT",
    workId: TIDEWRACK_WORK_ID,
    narrativeUnitId: `${TIDEWRACK_WORK_ID}-unit-2`,
    title: "The Salt Ledger, Ch. 2",
    reference: null,
  },
];
