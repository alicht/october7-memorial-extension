function updateWarDayAndDates() {
    const warStart = new Date("2023-10-07T00:00:00Z");
    const today = new Date();
    const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const utcStart = warStart.getTime();
    const daysSince = Math.floor((utcToday - utcStart) / (1000 * 60 * 60 * 24)) + 1;
  
    // Update War Day text
    const warDayEl = document.getElementById("war-day");
    if (warDayEl) {
      warDayEl.textContent = `🇮🇱 Israel at War – Day ${daysSince}`;
    }
  
    // Update Gregorian Date
    const gregorianEl = document.getElementById("gregorian-date");
    if (gregorianEl) {
      const engDate = today.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      });
      gregorianEl.textContent = `📆 ${engDate}`;
    }
  
    // Offline Hebrew Date
    const hebrewEl = document.getElementById("hebrew-date");
    if (hebrewEl) {
      const hebDate = today.toLocaleDateString("he-IL-u-ca-hebrew", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      });
      hebrewEl.textContent = `🕍 ${hebDate}`;
    }
  }
  
  document.addEventListener("DOMContentLoaded", updateWarDayAndDates);
  