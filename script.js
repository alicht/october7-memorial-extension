console.log("🔄 Loading random victim from victims_data.js");

// Add tags to each victim based on their story/bio
const taggedVictims = victims_data.map(victim => {
  const tags = [];
  
  // Check for different categories
  if (victim.bio.toLowerCase().includes('supernova') || victim.story.toLowerCase().includes('supernova')) {
    tags.push('supernova');
  }
  if (victim.bio.toLowerCase().includes('kidnapped') || victim.bio.toLowerCase().includes('captivity') || victim.story.toLowerCase().includes('kidnapped')) {
    tags.push('hostages');
  }
  if (victim.bio.toLowerCase().includes('soldier') || victim.bio.toLowerCase().includes('sgt') || victim.bio.toLowerCase().includes('cpt') || victim.name.toLowerCase().includes('sgt') || victim.name.toLowerCase().includes('cpt')) {
    tags.push('soldiers');
  }
  if (victim.bio.toLowerCase().includes('thai') || victim.bio.toLowerCase().includes('nepali') || victim.story.toLowerCase().includes('thailand') || victim.story.toLowerCase().includes('nepal')) {
    tags.push('foreign-workers');
  }
  if (!tags.includes('soldiers') && !tags.includes('foreign-workers')) {
    tags.push('civilians');
  }
  
  return { ...victim, tags };
});

let currentFilter = 'all';
let currentSearchTerm = '';

function getFilteredVictims() {
  let filtered = taggedVictims;
  
  // Apply filter
  if (currentFilter !== 'all') {
    filtered = filtered.filter(victim => victim.tags.includes(currentFilter));
  }
  
  // Apply search
  if (currentSearchTerm) {
    filtered = filtered.filter(victim => 
      victim.name.toLowerCase().includes(currentSearchTerm.toLowerCase()) ||
      victim.bio.toLowerCase().includes(currentSearchTerm.toLowerCase()) ||
      victim.story.toLowerCase().includes(currentSearchTerm.toLowerCase())
    );
  }
  
  return filtered;
}

function loadRandomVictim() {
  try {
    const filteredVictims = getFilteredVictims();
    
    if (filteredVictims.length === 0) {
      document.getElementById("victim-name").textContent = "No victims found";
      document.getElementById("victim-bio").textContent = currentSearchTerm ? 
        `No results for "${currentSearchTerm}"` : "No victims found for this filter";
      document.getElementById("victim-story").innerHTML = "";
      document.getElementById("victim-image").src = "";
      document.getElementById("victim-link").href = "";
      return;
    }
    
    const randomVictim = filteredVictims[Math.floor(Math.random() * filteredVictims.length)];
    loadSpecificVictim(randomVictim);

  } catch (err) {
    console.error("🚨 Error loading victim:", err);
    document.body.innerHTML = "<h2>Failed to load victim data.</h2>";
  }
}

function loadSpecificVictim(victim) {
  // Set image
  document.getElementById("victim-image").src = victim.image;
  document.getElementById("victim-image").alt = victim.name;

  // Set name and age
  document.getElementById("victim-name").textContent = `${victim.name}, ${victim.age}`;

  // Set short bio
  document.getElementById("victim-bio").textContent = victim.bio;

  // Set full story with first paragraph visible
  const storyContainer = document.getElementById("victim-story");
  const storyContent = storyContainer.querySelector('.story-content');
  
  if (victim.story && storyContent) {
    // Clear existing content
    storyContent.innerHTML = '';
    
    const paragraphs = victim.story.split(/\n\s*\n/); // Split on double newlines
    const cleanParagraphs = paragraphs.filter(p => p.trim()); // Remove empty paragraphs
    
    if (cleanParagraphs.length > 0) {
      // Create first paragraph container
      const firstParagraphDiv = document.createElement("div");
      firstParagraphDiv.className = "first-paragraph";
      const firstPara = document.createElement("p");
      firstPara.textContent = cleanParagraphs[0].trim();
      firstParagraphDiv.appendChild(firstPara);
      storyContent.appendChild(firstParagraphDiv);
      
      // Create remaining paragraphs container (if there are more)
      if (cleanParagraphs.length > 1) {
        const remainingParagraphsDiv = document.createElement("div");
        remainingParagraphsDiv.className = "remaining-paragraphs";
        
        cleanParagraphs.slice(1).forEach(p => {
          const paraEl = document.createElement("p");
          paraEl.textContent = p.trim();
          remainingParagraphsDiv.appendChild(paraEl);
        });
        
        storyContent.appendChild(remainingParagraphsDiv);
        
        // Show expand button only if there are more paragraphs
        storyContainer.classList.add('collapsed');
        storyContainer.classList.remove('expanded');
      } else {
        // No additional paragraphs, hide expand button
        storyContainer.classList.add('expanded');
        storyContainer.classList.remove('collapsed');
      }
    }
  }

  // Link to original article
  document.getElementById("victim-link").href = victim.url;
}

function performSearch() {
  const filteredVictims = getFilteredVictims();
  
  if (filteredVictims.length === 1) {
    // If only one result, show it directly
    loadSpecificVictim(filteredVictims[0]);
  } else if (filteredVictims.length > 1) {
    // Multiple results, show a random one
    loadRandomVictim();
  } else {
    // No results
    loadRandomVictim(); // This will handle the "no results" case
  }
}

function setupEventListeners() {
  // Shuffle button
  const shuffleButton = document.getElementById('shuffle-button');
  if (shuffleButton) {
    shuffleButton.addEventListener('click', loadRandomVictim);
  }

  // Search box
  const searchBox = document.getElementById('search-box');
  if (searchBox) {
    searchBox.addEventListener('input', function() {
      currentSearchTerm = this.value;
      performSearch();
    });
    
    // Also search on Enter key
    searchBox.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        performSearch();
      }
    });
  }

  // Filter tags
  const filterTags = document.querySelectorAll('.filter-tag');
  filterTags.forEach(tag => {
    tag.addEventListener('click', function() {
      // Remove active class from all tags
      filterTags.forEach(t => t.classList.remove('active'));
      
      // Add active class to clicked tag
      this.classList.add('active');
      
      // Set current filter
      currentFilter = this.dataset.filter;
      
      // Load new victim with filter
      performSearch();
    });
  });

  // Expand/collapse story
  const expandButton = document.getElementById('expand-button');
  if (expandButton) {
    expandButton.addEventListener('click', function() {
      const storyContainer = document.getElementById("victim-story");
      storyContainer.classList.remove('collapsed');
      storyContainer.classList.add('expanded');
    });
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  setupEventListeners();
  loadRandomVictim();
});

// Also load initial victim immediately (in case DOMContentLoaded already fired)
if (document.readyState === 'loading') {
  // Still loading, wait for DOMContentLoaded
} else {
  // Already loaded
  setupEventListeners();
  loadRandomVictim();
}