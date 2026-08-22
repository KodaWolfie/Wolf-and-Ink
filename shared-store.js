/**
 * shared-store.js
 * Centralised storage for Wolf & Ink.
 *
 * Story shape (wolfsInk_stories_v1):
 *   { id, title, shelfId, manuscript, notes, createdAt, updatedAt, coverImage }
 *
 * Shelf shape (beastsLibrary_v1):
 *   { shelves: [{ id, name, desc }] }
 *
 * Tinker's Nook note shape (tinkersNook_notes_v1):
 *   { id, paletteIndex, title, body, createdAt, updatedAt }
 *
 * Legacy data in beastsLibrary_v1 (stories array) is migrated automatically.
 */

(function (global) {
  "use strict";

  const STORY_KEY = "wolfsInk_stories_v1";
  const SHELF_KEY = "beastsLibrary_v1";
  const TINKER_KEY = "tinkersNook_notes_v1";

  /* ── Helpers ── */
  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function now() {
    return new Date().toISOString();
  }

  /* ── Low-level read / write ── */
  function readStoryStore() {
    try {
      const raw = localStorage.getItem(STORY_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { stories: [] };
  }

  function writeStoryStore(store) {
    try { localStorage.setItem(STORY_KEY, JSON.stringify(store)); } catch (_) {}
  }

  function readShelfStore() {
    try {
      const raw = localStorage.getItem(SHELF_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { shelves: [], stories: [] };
  }

  function writeShelfStore(store) {
    try { localStorage.setItem(SHELF_KEY, JSON.stringify(store)); } catch (_) {}
  }

  function readTinkerStore() {
    try {
      const raw = localStorage.getItem(TINKER_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { notes: [] };
  }

  function writeTinkerStore(store) {
    try { localStorage.setItem(TINKER_KEY, JSON.stringify(store)); } catch (_) {}
  }

  /* ── Migration: move legacy stories from beastsLibrary_v1 into wolfsInk_stories_v1 ── */
  function migrate() {
    const shelfStore = readShelfStore();
    if (!Array.isArray(shelfStore.stories) || shelfStore.stories.length === 0) return;

    const storyStore = readStoryStore();
    const existingIds = new Set(storyStore.stories.map(s => s.id));

    shelfStore.stories.forEach(old => {
      if (existingIds.has(old.id)) return;
      storyStore.stories.push({
        id: old.id,
        title: old.title || "Untitled",
        shelfId: old.shelfId || null,
        manuscript: "",
        notes: "",
        createdAt: now(),
        updatedAt: now(),
        coverImage: null,
      });
    });

    writeStoryStore(storyStore);

    // Remove legacy stories array to avoid re-migration
    delete shelfStore.stories;
    writeShelfStore(shelfStore);
  }

  /* ── Story API ── */
  function getStories() {
    return readStoryStore().stories;
  }

  function getStory(id) {
    return readStoryStore().stories.find(s => s.id === id) || null;
  }

  function saveStory(story) {
    const store = readStoryStore();
    const idx = store.stories.findIndex(s => s.id === story.id);
    story.updatedAt = now();
    if (idx >= 0) {
      store.stories[idx] = story;
    } else {
      if (!story.id) story.id = uid();
      if (!story.createdAt) story.createdAt = now();
      store.stories.push(story);
    }
    writeStoryStore(store);
    return story;
  }

  function createStory(title, shelfId) {
    return saveStory({
      id: uid(),
      title: title || "Untitled",
      shelfId: shelfId || null,
      manuscript: "",
      notes: "",
      createdAt: now(),
      updatedAt: now(),
      coverImage: null,
    });
  }

  function deleteStory(id) {
    const store = readStoryStore();
    store.stories = store.stories.filter(s => s.id !== id);
    writeStoryStore(store);
  }

  /* ── Shelf API ── */
  function getShelves() {
    return readShelfStore().shelves || [];
  }

  function saveShelf(shelf) {
    const store = readShelfStore();
    if (!store.shelves) store.shelves = [];
    const idx = store.shelves.findIndex(s => s.id === shelf.id);
    if (idx >= 0) {
      store.shelves[idx] = shelf;
    } else {
      if (!shelf.id) shelf.id = uid();
      store.shelves.push(shelf);
    }
    writeShelfStore(store);
    return shelf;
  }

  function deleteShelf(id) {
    const store = readShelfStore();
    store.shelves = (store.shelves || []).filter(s => s.id !== id);
    writeShelfStore(store);

    // Move orphaned stories to unsorted
    const storyStore = readStoryStore();
    storyStore.stories.forEach(s => { if (s.shelfId === id) s.shelfId = null; });
    writeStoryStore(storyStore);
  }

  /* ── Tinker's Nook API ── */
  function getTinkerNotes() {
    return readTinkerStore().notes;
  }

  function getTinkerNote(id) {
    return readTinkerStore().notes.find(note => note.id === id) || null;
  }

  function saveTinkerNote(note) {
    const store = readTinkerStore();
    const nextNote = { ...note };
    const idx = store.notes.findIndex(n => n.id === nextNote.id);
    if (idx >= 0) {
      nextNote.updatedAt = now();
      store.notes[idx] = nextNote;
    } else {
      if (!nextNote.id) nextNote.id = uid();
      if (!nextNote.createdAt) nextNote.createdAt = now();
      nextNote.updatedAt = now();
      store.notes.push(nextNote);
    }
    writeTinkerStore(store);
    return nextNote;
  }

  function deleteTinkerNote(id) {
    const store = readTinkerStore();
    store.notes = store.notes.filter(note => note.id !== id);
    writeTinkerStore(store);
  }

  /* ── Cover image: compress via canvas before storing ── */
  function compressCover(dataUrl, callback) {
    if (!dataUrl || !dataUrl.startsWith("data:image/")) {
      callback(dataUrl);
      return;
    }
    const MAX_W = 600, MAX_H = 900, QUALITY = 0.82;
    const img = new Image();
    img.onload = function () {
      let w = img.width, h = img.height;
      const ratio = Math.min(MAX_W / w, MAX_H / h, 1);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL("image/jpeg", QUALITY));
    };
    img.onerror = function () { callback(dataUrl); };
    img.src = dataUrl;
  }

  /* ── Auto-migrate on load ── */
  migrate();

  /* ── Expose public API ── */
  global.WolfInkStore = {
    uid,
    getStories,
    getStory,
    saveStory,
    createStory,
    deleteStory,
    getShelves,
    saveShelf,
    deleteShelf,
    getTinkerNotes,
    getTinkerNote,
    saveTinkerNote,
    deleteTinkerNote,
    compressCover,
  };
})(window);
