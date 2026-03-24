export const FAVORITE_FOLDER_SECTION_ID = 'favorite-folders';
export const FAVORITE_VIDEO_SECTION_ID = 'favorites-videos';

type FocusLeaveFor = {
  left?: string;
  right?: string;
  up?: string;
  down?: string;
};

export function buildFavoriteFolderFocusId(index: number): string {
  return `favorite-folder-${index}`;
}

export function buildFavoriteFolderSectionLeaveFor(): FocusLeaveFor {
  return {
    left: '@side-nav',
    down: `@${FAVORITE_VIDEO_SECTION_ID}`,
  };
}

export function buildFavoriteVideoSectionLeaveFor(activeFolderIndex: number | null): FocusLeaveFor {
  if (activeFolderIndex === null) {
    return {
      left: '@side-nav',
    };
  }

  return {
    left: '@side-nav',
    up: buildFavoriteFolderFocusId(activeFolderIndex),
  };
}
