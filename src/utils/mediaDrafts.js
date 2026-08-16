/**
 * Helpers for the media rows the suggestion forms edit. A draft is one row of
 * media.csv while it is being written: either a link (platform + source) or an
 * uploaded file (media_id, optionally credited).
 *
 * @typedef {import("../store/types").MediaItem} MediaItem
 * @typedef {import("../components/MediaList").MediaDraft} MediaDraft
 */

// Row keys only have to be unique within a page, and a counter keeps them
// stable while rows are added, edited and removed.
let uidCounter = 0;
const nextUid = () => `media-${(uidCounter += 1)}`;

/**
 * A blank link row for the user to fill in.
 *
 * @returns {MediaDraft}
 */
export const emptyLinkDraft = () => ({
    uid: nextUid(),
    kind: "link",
    description: "",
    source: "",
    platform: "",
    credit: "",
});

/**
 * A row for a file that just finished uploading. Description and credit start
 * empty; the user fills them in on the row.
 *
 * @param {Object} result the upload response
 * @param {File} file
 * @returns {MediaDraft}
 */
export const uploadToDraft = (result, file) => ({
    uid: nextUid(),
    kind: "upload",
    description: "",
    source: "",
    platform: "",
    credit: "",
    media_id: result.id,
    previewUrl: result.urls?.preview ?? null,
    fileName: file.name,
});

/**
 * A row seeded from media the event already has, so the edit form can propose
 * changes to it or ask for its removal.
 *
 * @param {MediaItem} item
 * @returns {MediaDraft}
 */
export const existingToDraft = (item) => ({
    uid: `existing-${item.index}`,
    index: item.index,
    kind: item.kind,
    description: item.description,
    source: item.source,
    platform: item.platform,
    credit: item.credit,
    media_id: item.media_id,
    previewUrl: item.urlThumb ?? item.urlWebp,
    deleted: false,
});

/**
 * Whether a row has everything it needs. A link is useless without both a URL
 * and the platform it points at; an upload always has its file.
 *
 * @param {MediaDraft} item
 * @returns {boolean}
 */
export const isMediaComplete = (item) =>
    item.kind === "upload" || (item.source.trim().length > 0 && item.platform.length > 0);

/**
 * Whether a row differs from the media it was seeded with.
 *
 * @param {MediaDraft} draft
 * @param {MediaItem} original
 * @returns {boolean}
 */
export const isMediaEdited = (draft, original) =>
    draft.description.trim() !== original.description ||
    draft.source.trim() !== original.source ||
    draft.platform !== original.platform ||
    draft.credit.trim() !== original.credit;

/**
 * The payload for a brand new media row. Uploads send the id the upload
 * endpoint issued (plus the file name, so admins recognise it); links send
 * where they point.
 *
 * @param {MediaDraft} item
 * @returns {Object}
 */
export const mediaToPayload = (item) =>
    item.kind === "upload"
        ? {
              description: item.description.trim(),
              media_id: item.media_id,
              file_name: item.fileName,
              credit: item.credit.trim(),
          }
        : {
              description: item.description.trim(),
              source: item.source.trim(),
              platform: item.platform,
          };

/**
 * The payload for a change to media the event already has. media_index is the
 * row's position among that event's rows in media.csv, which together with the
 * media_id or source pins down which row is meant.
 *
 * @param {MediaDraft} draft
 * @returns {Object}
 */
export const editedMediaPayload = (draft) => ({
    media_index: draft.index,
    media_id: draft.media_id ?? "",
    description: draft.description.trim(),
    source: draft.source.trim(),
    platform: draft.platform,
    credit: draft.credit.trim(),
});

/**
 * The payload for media the user wants removed.
 *
 * @param {MediaDraft} draft
 * @returns {Object}
 */
export const deletedMediaPayload = (draft) => ({
    media_index: draft.index,
    media_id: draft.media_id ?? "",
    source: draft.source.trim(),
    description: draft.description.trim(),
});
