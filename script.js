// Use global victims_data if defined by victims_data.js
var victims_data = window.victims_data || [];
let currentFilter = 'all';
let currentSearchTerm = '';

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

function loadRandomVictim() {
  try {
    const filteredVictims = getFilteredVictims();

    if (filteredVictims.length === 0) {
      document.getElementById("victim-name").textContent = "No victims found";
      document.getElementById("victim-bio").textContent = currentSearchTerm ?
        `No results for "${currentSearchTerm}"` : "No victims found for this filter";
      document.getElementById("victim-story").innerHTML = "";
      document.getElementById("victim-image").src = "";
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
      .replace(/([A-Za-z])\.\s*\n\s*([A-Za-z])/g, '$1. $2')  // Fix "Sgt.\nDavid"
      .replace(/([a-z])\n([A-Z])/g, '$1 $2');                // Fix lowercase line break

    const footerTriggers = [
      "If so, we have a request.",
      "We're really pleased that you've read",
      "Please consider joining our reader support group",
      "Your support is essential",
      "© 2025 The Times Of Israel",
      "Today's Daily Briefing",
      "Those We Have Lost",
      "Wartime Diaries",
      "Those We Are Missing"
    ];

    for (const trigger of footerTriggers) {
      if (cleanStory.includes(trigger)) {
        cleanStory = cleanStory.split(trigger)[0];
        break;
      }
    }

    const paragraphs = cleanStory
      .split(/\n\s*\n|(?<=\.)\n+/)  // double newline or newline after sentence
      .map(p => p.trim())
      .filter(p => p.length > 0);

    paragraphs.forEach(paragraph => {
      const p = document.createElement("p");
      p.textContent = paragraph;
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
      loadRandomVictim();
    });
  });

  document.getElementById('search-box').addEventListener('input', (e) => {
    currentSearchTerm = e.target.value;
    loadRandomVictim();
  });
});
