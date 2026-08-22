(function () {
  const STORIES_KEY = "wolfsInk_stories_v1";
  const SHELVES_KEY = "beastsLibrary_v1";

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function normalizeStory(story) {
    if (!story || typeof story !== "object") return null;
    const now = new Date().toISOString();
    return {
      id: story.id || uid(),
      title: story.title || "Untitled Story",
      shelfId: story.shelfId || null,
      manuscript: typeof story.manuscript === "string" ? story.manuscript : "",
      notes: typeof story.notes === "string" ? story.notes : "",
      coverImage: typeof story.coverImage === "string" ? story.coverImage : null,
      createdAt: story.createdAt || now,
      updatedAt: story.updatedAt || now
    };
  }

  function loadStories() {
    const stories = readJson(STORIES_KEY, []);
    if (!Array.isArray(stories)) return [];
    return stories.map(normalizeStory).filter(Boolean);
  }

  function saveStories(arr) {
    const stories = Array.isArray(arr) ? arr.map(normalizeStory).filter(Boolean) : [];
    writeJson(STORIES_KEY, stories);
    return stories;
  }

  function saveStory(story) {
    const stories = loadStories();
    const incoming = normalizeStory(story);
    if (!incoming) return null;
    const now = new Date().toISOString();
    const index = stories.findIndex(function (item) {
      return item.id === incoming.id;
    });

    if (index >= 0) {
      const existing = stories[index];
      stories[index] = {
        ...existing,
        ...incoming,
        createdAt: existing.createdAt || incoming.createdAt || now,
        updatedAt: now
      };
    } else {
      stories.push({
        ...incoming,
        createdAt: incoming.createdAt || now,
        updatedAt: now
      });
    }

    saveStories(stories);
    return getStory(incoming.id);
  }

  function getStory(id) {
    if (!id) return null;
    const story = loadStories().find(function (item) {
      return item.id === id;
    });
    return story || null;
  }

  function deleteStory(id) {
    const stories = loadStories().filter(function (item) {
      return item.id !== id;
    });
    saveStories(stories);
  }

  function getShelves() {
    const data = readJson(SHELVES_KEY, { shelves: [] });
    return Array.isArray(data && data.shelves) ? data.shelves : [];
  }

  function saveShelves(shelves) {
    writeJson(SHELVES_KEY, {
      shelves: Array.isArray(shelves) ? shelves : []
    });
  }

  function migrateOldStories() {
    const library = readJson(SHELVES_KEY, { shelves: [] });
    const oldStories = Array.isArray(library && library.stories) ? library.stories : [];
    if (!oldStories.length) return;

    const existingStories = loadStories();
    const existingIds = new Set(existingStories.map(function (story) {
      return story.id;
    }));
    const now = new Date().toISOString();
    const migrated = existingStories.slice();

    oldStories.forEach(function (story) {
      if (!story || existingIds.has(story.id)) return;
      migrated.push({
        id: story.id || uid(),
        title: story.title || "Untitled Story",
        shelfId: story.shelfId || null,
        manuscript: "",
        notes: "",
        coverImage: null,
        createdAt: now,
        updatedAt: now
      });
    });

    saveStories(migrated);
    saveShelves(Array.isArray(library.shelves) ? library.shelves : []);
  }

  window.WolfInkStore = {
    uid: uid,
    loadStories: loadStories,
    saveStories: saveStories,
    saveStory: saveStory,
    getStory: getStory,
    deleteStory: deleteStory,
    getShelves: getShelves,
    saveShelves: saveShelves,
    migrateOldStories: migrateOldStories
  };
})();
