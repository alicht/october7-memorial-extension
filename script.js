// Use global victims_data if defined by victims_data.js
var victims_data = window.victims_data || [];
let currentFilter = 'all';
let currentSearchTerm = '';
let searchTimeout = null;
let selectedSuggestionIndex = -1;
let isSearchMode = false;

// SAFE_MODE guard - can be disabled with window.__SEARCH_SAFE_MODE__ = false
window.__SEARCH_SAFE_MODE__ = window.__SEARCH_SAFE_MODE__ !== false;

/**
 * Adds tags to each victim based on keywords found in their bio, story, or name.
 * @param {Array<Object>} victims - The array of victim objects with added 'tags' property.
 */
function tagVictims(victims) {
  return victims.map(victim => {
    const tags = [];
    const lowerBio = victim.bio ? victim.bio.toLowerCase() : '';
    const lowerStory = victim.story ? victim.story.toLowerCase() : '';
    const lowerName = victim.name ? victim.name.toLowerCase() : '';

    if (lowerBio.includes('nova') || lowerStory.includes('nova')) {
      tags.push('nova');
    }
    if (lowerBio.includes('kidnapped') || lowerBio.includes('captivity') || lowerStory.includes('kidnapped')) {
      tags.push('hostages');
    }
    if (lowerBio.includes('soldier') || lowerBio.includes('sgt') || lowerBio.includes('cpt') || lowerName.includes('sgt') || lowerName.includes('cpt')) {
      tags.push('soldiers');
    }
    if (!tags.includes('soldiers') && !tags.includes('foreign-workers')) {
      tags.push('civilians');
    }

    return { ...victim, tags };
  });
}

function getFilteredVictims() {
  if (victims_data.length === 0) {
    console.error("🚨 Error: victims_data is empty. Ensure victims_data.js is loaded and contains data.");
    return [];
  }

  let filtered = victims_data;

  // Apply tag filter only - search is handled separately
  if (currentFilter !== 'all') {
    filtered = filtered.filter(victim => victim.tags.includes(currentFilter));
  }

  return filtered;
}

/**
 * Gets the base dataset for search (filtered by tag, but not by search term)
 * @returns {Array} Filtered victim array for search operations
 */
function getSearchableVictims() {
  if (victims_data.length === 0) {
    return [];
  }

  let searchable = victims_data;

  // Apply active tag filter
  if (currentFilter !== 'all') {
    searchable = searchable.filter(victim => victim.tags.includes(currentFilter));
  }

  return searchable;
}

// ✅ Clean up TOI footer junk
function cleanStoryText(text) {
  const cutoffPhrases = [
    "We're really pleased that you've read",
    "Those We Have Lost stories here",
    "Sign up for",
    "Support the Times of Israel",
    "Please join The Times of Israel Community",
    "You’re a dedicated reader",
    "If so, we have a request.",
    "Your support is essential",
    "Today's Daily Briefing",
    "Those We Are Missing",
    "Wartime Diaries",
    "© 2025 The Times Of Israel"
  ];
  for (let phrase of cutoffPhrases) {
    if (text.includes(phrase)) {
      return text.split(phrase)[0].trim();
    }
  }
  return text;
}

/**
 * Normalizes text by removing diacritics and converting to lowercase for searching
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
function normalizeText(text) {
  return text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics
}

/**
 * Highlights matching text in a string
 * @param {string} text - Original text
 * @param {string} query - Search query to highlight
 * @returns {string} HTML with highlighted matches
 */
function highlightMatch(text, query) {
  if (!query.trim()) return text;
  
  const normalizedText = normalizeText(text);
  const normalizedQuery = normalizeText(query);
  const index = normalizedText.indexOf(normalizedQuery);
  
  if (index === -1) return text;
  
  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);
  
  return `${before}<span class="match-highlight">${match}</span>${after}`;
}

/**
 * Searches victims by name with fuzzy matching
 * @param {string} query - Search query
 * @param {number} limit - Maximum results to return
 * @returns {Array} Array of matching victims with scores
 */
function searchVictims(query, limit = 10) {
  if (!query.trim()) return [];
  
  const normalizedQuery = normalizeText(query);
  const results = [];
  
  // FIXED: Search within tag-filtered results, not raw victims_data
  const searchableVictims = getSearchableVictims();
  
  searchableVictims.forEach(victim => {
    const normalizedName = normalizeText(victim.name);
    
    // Exact match gets highest score
    if (normalizedName === normalizedQuery) {
      results.push({ victim, score: 100 });
      return;
    }
    
    // Name starts with query gets high score
    if (normalizedName.startsWith(normalizedQuery)) {
      results.push({ victim, score: 90 });
      return;
    }
    
    // Name contains query gets medium score
    if (normalizedName.includes(normalizedQuery)) {
      results.push({ victim, score: 70 });
      return;
    }
    
    // Bio or story contains query gets low score
    const normalizedBio = normalizeText(victim.bio || '');
    const normalizedStory = normalizeText(victim.story || '');
    
    if (normalizedBio.includes(normalizedQuery) || normalizedStory.includes(normalizedQuery)) {
      results.push({ victim, score: 30 });
    }
  });
  
  // Sort by score descending, then by name
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.victim.name.localeCompare(b.victim.name);
  });
  
  return results.slice(0, limit).map(r => r.victim);
}

/**
 * Creates a disambiguation string for victims with same names
 * @param {Object} victim - Victim object
 * @param {Array} allVictims - All victims to check for duplicates
 * @returns {string} Disambiguation string
 */
function getDisambiguator(victim, allVictims) {
  const sameName = allVictims.filter(v => v.name === victim.name);
  if (sameName.length <= 1) return `Age ${victim.age}`;
  
  // For duplicates, try age first, then add more details
  const details = [`Age ${victim.age}`];
  
  // Add location if available in bio
  const bio = victim.bio || '';
  const locationMatch = bio.match(/from ([^,]+)/i);
  if (locationMatch) {
    details.push(locationMatch[1]);
  }
  
  return details.join(', ');
}

/**
 * Displays search suggestions
 * @param {Array} suggestions - Array of victim objects
 * @param {string} query - Original search query
 */
function displaySuggestions(suggestions, query) {
  const suggestionsEl = document.getElementById('search-suggestions');
  
  if (suggestions.length === 0) {
    suggestionsEl.classList.add('hidden');
    return;
  }
  
  suggestionsEl.innerHTML = '';
  selectedSuggestionIndex = -1;
  
  suggestions.forEach((victim, index) => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.dataset.index = index;
    
    const nameEl = document.createElement('div');
    nameEl.className = 'suggestion-name';
    nameEl.innerHTML = highlightMatch(victim.name, query);
    
    const detailsEl = document.createElement('div');
    detailsEl.className = 'suggestion-details';
    detailsEl.textContent = getDisambiguator(victim, victims_data);
    
    item.appendChild(nameEl);
    item.appendChild(detailsEl);
    
    item.addEventListener('click', () => selectSuggestion(victim));
    suggestionsEl.appendChild(item);
  });
  
  suggestionsEl.classList.remove('hidden');
}

/**
 * Hides search suggestions
 */
function hideSuggestions() {
  const suggestionsEl = document.getElementById('search-suggestions');
  suggestionsEl.classList.add('hidden');
  selectedSuggestionIndex = -1;
}

/**
 * Handles keyboard navigation in suggestions
 * @param {KeyboardEvent} e - Keyboard event
 */
function handleSuggestionNavigation(e) {
  const suggestionsEl = document.getElementById('search-suggestions');
  const items = suggestionsEl.querySelectorAll('.suggestion-item');
  
  if (items.length === 0) return;
  
  // Remove previous highlight
  items.forEach(item => item.classList.remove('highlighted'));
  
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, items.length - 1);
      break;
    case 'ArrowUp':
      e.preventDefault();
      selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
      break;
    case 'Enter':
      e.preventDefault();
      if (selectedSuggestionIndex >= 0) {
        const suggestions = searchVictims(currentSearchTerm);
        selectSuggestion(suggestions[selectedSuggestionIndex]);
      } else if (currentSearchTerm.trim()) {
        // Select first suggestion if available
        const suggestions = searchVictims(currentSearchTerm, 1);
        if (suggestions.length > 0) {
          selectSuggestion(suggestions[0]);
        }
      }
      return;
    case 'Escape':
      hideSuggestions();
      document.getElementById('search-box').blur();
      return;
  }
  
  // Highlight selected item
  if (selectedSuggestionIndex >= 0) {
    items[selectedSuggestionIndex].classList.add('highlighted');
  }
}

/**
 * Selects a suggestion and loads the victim
 * @param {Object} victim - Selected victim
 */
function selectSuggestion(victim) {
  isSearchMode = true;
  hideSuggestions();
  document.getElementById('search-box').value = victim.name;
  currentSearchTerm = victim.name;
  loadSpecificVictim(victim);
}

/**
 * Resets to default state (shows random victim from current filter)
 */
function resetToDefaultState() {
  isSearchMode = false;
  currentSearchTerm = '';
  hideSuggestions();
  hideEmptyState(); // Hide empty state when resetting
  
  // CRITICAL: Never show global error on reset - this is just a UI state change
  try {
    // Check if data is available at all
    if (!victims_data || victims_data.length === 0) {
      console.warn("⚠️ No victim data available during reset");
      showNoResults("No victim data available. Please refresh the page.");
      return;
    }
    
    const filteredVictims = getFilteredVictims();
    
    if (filteredVictims.length === 0) {
      // This is just a filter result - not a system error
      showNoResults("No victims found for this filter");
      return;
    }
    
    const randomVictim = filteredVictims[Math.floor(Math.random() * filteredVictims.length)];
    loadSpecificVictim(randomVictim);
  } catch (err) {
    console.error("🚨 Error in reset (non-critical):", err);
    // This is a UI operation failure, not data loading failure
    showNoResults("Unable to display victim. Please try again.");
  }
}

/**
 * Shows a global error banner for critical data loading failures only
 * @param {string} message - Error message to display
 */
function showGlobalError(message) {
  document.getElementById("victim-name").textContent = "System Error";
  document.getElementById("victim-bio").textContent = message;
  document.getElementById("victim-story").innerHTML = "";
  document.getElementById("victim-image").src = "";
  console.error("🚨 Global Error:", message);
}

/**
 * Shows local empty state for search with no results
 * @param {string} query - Search query that returned no results
 */
function handleNoResults(query) {
  const activeFilterLabel = getActiveFilterLabel();
  const emptyStateEl = document.getElementById('empty-state');
  
  if (!emptyStateEl) {
    console.warn('Empty state element not found');
    return;
  }
  
  const filterInfo = activeFilterLabel && activeFilterLabel !== 'All' 
    ? `<div class="empty-filter-info">Searched within: ${escapeHtml(activeFilterLabel)}</div>`
    : '';
  
  emptyStateEl.innerHTML = `
    <div class="empty-title">No matches found</div>
    <div class="empty-subtitle">No matches for "${escapeHtml(query)}".</div>
    ${filterInfo}
    <div class="empty-actions">
      <button id="btn-clear-search" class="action-btn" type="button">Clear search</button>
      <button id="btn-surprise" class="action-btn secondary" type="button">Another story</button>
    </div>
  `;
  
  emptyStateEl.hidden = false;
  wireEmptyStateActions();
  
  // Hide suggestions dropdown
  hideSuggestions();
}

/**
 * Hides the empty state component
 */
function hideEmptyState() {
  const emptyStateEl = document.getElementById('empty-state');
  if (emptyStateEl) {
    emptyStateEl.hidden = true;
  }
}

/**
 * Gets the current active filter label for display
 * @returns {string} Filter label
 */
function getActiveFilterLabel() {
  const filterMap = {
    'all': 'All',
    'nova': 'Nova Festival',
    'hostages': 'Hostages',
    'soldiers': 'Soldiers',
    'civilians': 'Civilians',
    'foreign-workers': 'Foreign Workers'
  };
  return filterMap[currentFilter] || 'All';
}

/**
 * Escapes HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Wires up empty state action buttons
 */
function wireEmptyStateActions() {
  const clearBtn = document.getElementById('btn-clear-search');
  const surpriseBtn = document.getElementById('btn-surprise');
  
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearSearchInput();
      hideEmptyState();
      resetToDefaultState();
    });
  }
  
  if (surpriseBtn) {
    surpriseBtn.addEventListener('click', () => {
      hideEmptyState();
      loadRandomVictim();
    });
  }
}

/**
 * Clears the search input field
 */
function clearSearchInput() {
  const searchBox = document.getElementById('search-box');
  if (searchBox) {
    searchBox.value = '';
    currentSearchTerm = '';
  }
}

/**
 * Shows victim pill (restores visibility) - DEPRECATED: No longer hiding pill
 */
function showVictimPill() {
  // No longer needed - we don't hide the victim pill
}

/**
 * Legacy showNoResults for backwards compatibility - now uses handleNoResults
 * @param {string} message - Message to display
 */
function showNoResults(message) {
  // Extract query from message if possible
  const queryMatch = message.match(/No results for ['"](.+?)['"]\.?/);
  const query = queryMatch ? queryMatch[1] : 'your search';
  handleNoResults(query);
}

function loadRandomVictim() {
  // If in search mode, don't show random victim
  if (isSearchMode && currentSearchTerm.trim()) {
    const suggestions = searchVictims(currentSearchTerm, 1);
    if (suggestions.length > 0) {
      loadSpecificVictim(suggestions[0]);
      return;
    }
    // Show empty state for search with no results
    handleNoResults(currentSearchTerm);
    return;
  }
  
  try {
    // Check data availability first
    if (!victims_data || victims_data.length === 0) {
      console.warn("⚠️ No victim data available");
      showGlobalError("Unable to load victim data. Please refresh the page.");
      return;
    }
    
    const filteredVictims = getFilteredVictims();

    if (filteredVictims.length === 0) {
      // This is a filter result, not a data loading error
      showNoResults("No victims found for this filter");
      return;
    }

    const randomVictim = filteredVictims[Math.floor(Math.random() * filteredVictims.length)];
    loadSpecificVictim(randomVictim);
  } catch (err) {
    console.error("🚨 Error loading victim:", err);
    // Only show global error if it's truly a data loading issue
    if (!victims_data || victims_data.length === 0) {
      showGlobalError("Unable to load victim data. Please refresh the page.");
    } else {
      showNoResults("Unable to display victim. Please try again.");
    }
  }
}

function loadSpecificVictim(victim) {
  console.log("🧠 Selected victim object:", victim);
  
  // Hide empty state when loading a specific victim
  hideEmptyState();

  document.getElementById("victim-image").src = victim.image;
  document.getElementById("victim-image").alt = victim.name;
  document.getElementById("victim-name").textContent = `${victim.name}, ${victim.age}`;
  document.getElementById("victim-bio").textContent = victim.bio;

  const storyContainer = document.getElementById("victim-story");
  const storyContent = storyContainer.querySelector('.story-content');

  if (victim.story && storyContent) {
    console.log("🟢 Story found, rendering...");
    storyContent.innerHTML = '';

    let cleanStory = victim.story
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/([A-Za-z])\.\s*\n\s*([A-Za-z])/g, '$1. $2')
      .replace(/([a-z])\n([A-Z])/g, '$1 $2');

    cleanStory = cleanStoryText(cleanStory); // ✅ Clean footer garbage

    const paragraphs = cleanStory
      .split(/\n\s*\n|(?<=\.)\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

      paragraphs.forEach(paragraph => {
        let trimmed = paragraph.trim();
      
        if (trimmed.toLowerCase().endsWith("read more")) {
          // Remove just the last two words
          const words = trimmed.split(/\s+/);
          trimmed = words.slice(0, -2).join(" ");
        }
      
        const p = document.createElement("p");
        p.textContent = trimmed;
        storyContent.appendChild(p);
      });
  } else {
    console.warn("⚠️ No story found or storyContent is null.");
  }

  const expandBtn = document.getElementById("expand-button");
  expandBtn.href = victim.url;
  expandBtn.textContent = "Read more on Times of Israel";
}

document.addEventListener("DOMContentLoaded", () => {
  if (typeof window.victims_data !== 'undefined') {
    victims_data = window.victims_data;
  }

  victims_data = tagVictims(victims_data);
  loadRandomVictim();
  
  // Debug instrumentation for development
  window._dbg = {
    sample(n = 5) { 
      return victims_data.slice(0, n).map(v => v.name); 
    },
    dataCount() { 
      return victims_data?.length || 0; 
    },
    visibleCount() { 
      return getSearchableVictims()?.length || 0; 
    },
    search(q) { 
      return searchVictims(q, 10).map(v => v.name); 
    },
    currentState() {
      return {
        filter: currentFilter,
        searchTerm: currentSearchTerm,
        isSearchMode: isSearchMode,
        dataCount: victims_data?.length || 0,
        visibleCount: getSearchableVictims()?.length || 0,
        emptyStateVisible: !document.getElementById('empty-state')?.hidden
      };
    },
    testEmptyState(query = 'nonexistentname') {
      handleNoResults(query);
    },
    hideEmptyState() {
      hideEmptyState();
    }
  };

  document.querySelectorAll('.filter-tag').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.filter-tag').forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      currentFilter = button.dataset.filter;
      
      // Reset search when changing filters
      if (!currentSearchTerm.trim()) {
        resetToDefaultState();
      } else {
        loadRandomVictim();
      }
    });
  });

  const searchBox = document.getElementById('search-box');
  
  // Handle search input with debouncing
  searchBox.addEventListener('input', (e) => {
    const query = e.target.value;
    currentSearchTerm = query;
    
    // Clear previous timeout to prevent race conditions
    if (searchTimeout) {
      clearTimeout(searchTimeout);
      searchTimeout = null;
    }
    
    // If empty, reset to default state - NEVER trigger global error
    if (!query.trim()) {
      resetToDefaultState();
      return;
    }
    
    // Use safe mode or fallback to legacy behavior
    if (!window.__SEARCH_SAFE_MODE__) {
      // Legacy path - just filter without suggestions
      loadRandomVictim();
      return;
    }
    
    // Debounce search with safe error handling
    searchTimeout = setTimeout(() => {
      try {
        isSearchMode = true;
        const suggestions = searchVictims(query);
        displaySuggestions(suggestions, query);
        
        // Show first result in main area
        if (suggestions.length > 0) {
          loadSpecificVictim(suggestions[0]);
        } else {
          // Show empty state for no results
          handleNoResults(query);
        }
      } catch (err) {
        console.error("🚨 Search error (non-critical):", err);
        showNoResults(`Search failed for "${query}". Please try again.`);
      }
    }, 200);
  });
  
  // Handle keyboard navigation
  searchBox.addEventListener('keydown', handleSuggestionNavigation);
  
  // Hide suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      hideSuggestions();
    }
  });
  
  // Handle search box focus
  searchBox.addEventListener('focus', () => {
    if (currentSearchTerm.trim()) {
      const suggestions = searchVictims(currentSearchTerm);
      displaySuggestions(suggestions, currentSearchTerm);
    }
  });
});
