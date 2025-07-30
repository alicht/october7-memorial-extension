// Use global victims_data if defined by victims_data.js
var victims_data = window.victims_data || [];
let currentFilter = 'all';
let currentSearchTerm = '';
let searchTimeout = null;
let selectedSuggestionIndex = -1;
let isSearchMode = false;

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

  if (currentFilter !== 'all') {
    filtered = filtered.filter(victim => victim.tags.includes(currentFilter));
  }

  if (currentSearchTerm) {
    filtered = filtered.filter(victim =>
      victim.name.toLowerCase().includes(currentSearchTerm.toLowerCase()) ||
      victim.bio.toLowerCase().includes(currentSearchTerm.toLowerCase()) ||
      victim.story.toLowerCase().includes(currentSearchTerm.toLowerCase())
    );
  }

  return filtered;
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
  
  victims_data.forEach(victim => {
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
  
  try {
    const filteredVictims = getFilteredVictims();
    
    if (filteredVictims.length === 0) {
      document.getElementById("victim-name").textContent = "No victims found";
      document.getElementById("victim-bio").textContent = "No victims found for this filter";
      document.getElementById("victim-story").innerHTML = "";
      document.getElementById("victim-image").src = "";
      return;
    }
    
    const randomVictim = filteredVictims[Math.floor(Math.random() * filteredVictims.length)];
    loadSpecificVictim(randomVictim);
  } catch (err) {
    console.error("🚨 Error in reset:", err);
    // Don't replace entire body - just show local error
    showLocalError("Unable to load victim data. Please refresh the page.");
  }
}

/**
 * Shows a local error message without destroying the UI
 * @param {string} message - Error message to display
 */
function showLocalError(message) {
  document.getElementById("victim-name").textContent = "Error";
  document.getElementById("victim-bio").textContent = message;
  document.getElementById("victim-story").innerHTML = "";
  document.getElementById("victim-image").src = "";
}

function loadRandomVictim() {
  // If in search mode, don't show random victim
  if (isSearchMode && currentSearchTerm.trim()) {
    const suggestions = searchVictims(currentSearchTerm, 1);
    if (suggestions.length > 0) {
      loadSpecificVictim(suggestions[0]);
      return;
    }
    // Show no results for search
    document.getElementById("victim-name").textContent = "No results found";
    document.getElementById("victim-bio").textContent = `No results for "${currentSearchTerm}"`;
    document.getElementById("victim-story").innerHTML = "";
    document.getElementById("victim-image").src = "";
    return;
  }
  
  try {
    const filteredVictims = getFilteredVictims();

    if (filteredVictims.length === 0) {
      document.getElementById("victim-name").textContent = "No victims found";
      document.getElementById("victim-bio").textContent = "No victims found for this filter";
      document.getElementById("victim-story").innerHTML = "";
      document.getElementById("victim-image").src = "";
      return;
    }

    const randomVictim = filteredVictims[Math.floor(Math.random() * filteredVictims.length)];
    loadSpecificVictim(randomVictim);
  } catch (err) {
    console.error("🚨 Error loading victim:", err);
    showLocalError("Unable to load victim data. Please refresh the page.");
  }
}

function loadSpecificVictim(victim) {
  console.log("🧠 Selected victim object:", victim);

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
    
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // If empty, reset to default state
    if (!query.trim()) {
      resetToDefaultState();
      return;
    }
    
    // Debounce search
    searchTimeout = setTimeout(() => {
      isSearchMode = true;
      const suggestions = searchVictims(query);
      displaySuggestions(suggestions, query);
      
      // Show first result in main area
      if (suggestions.length > 0) {
        loadSpecificVictim(suggestions[0]);
      } else {
        // Show no results
        document.getElementById("victim-name").textContent = "No results found";
        document.getElementById("victim-bio").textContent = `No results for "${query}"`;
        document.getElementById("victim-story").innerHTML = "";
        document.getElementById("victim-image").src = "";
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
