# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome browser extension called "October 7 Memorial" that displays a memorial for victims of the October 7th attack on Israel. Each new tab shows a random victim with their photo, biography, and story, along with filtering and search capabilities.

## Architecture

### Core Components

- **manifest.json**: Chrome extension manifest (v3) that overrides new tab functionality
- **newtab.html**: Main UI template with sidebar filters and victim display area
- **victims_data.js**: Large data file (5MB+) containing victim information as a JavaScript array
- **script.js**: Main application logic for victim display, filtering, and search
- **dateBanner.js**: Calculates and displays war duration and current dates (Gregorian and Hebrew)
- **style.css**: Complete styling for responsive layout with sidebar and main content area

### Key Features

1. **Random Victim Display**: Shows random victim from filtered dataset on each page load
2. **Filtering System**: Filter by categories (Nova festival, hostages, soldiers, civilians, foreign workers)
3. **Search Functionality**: Real-time search across victim names, bios, and stories
4. **War Day Counter**: Displays days since October 7, 2023
5. **Responsive Design**: Mobile-friendly layout with sidebar that collapses on smaller screens

### Data Structure

The `victims_data` array contains objects with these properties:
- `name`: Victim's name
- `age`: Age at time of death
- `bio`: Short biographical description
- `story`: Longer narrative (often from Times of Israel)
- `image`: Photo URL
- `url`: Link to full Times of Israel article
- `tags`: Auto-generated tags for filtering (added by `tagVictims()` function)

### Text Processing

The extension includes robust text cleaning functionality:
- Removes Times of Israel footer content and promotional text
- Handles various newline formats and paragraph breaks
- Trims "read more" suffixes from paragraphs

## Development

### Testing the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this directory
4. Open a new tab to test

### No Build Process

This is a vanilla JavaScript extension with no build tools, package managers, or dependencies beyond the external Moment.js library loaded via CDN.

### File Modification Guidelines

- **victims_data.js**: Extremely large file (5MB+) - use offset/limit when reading or use Grep tool for searches
- **Style conventions**: Uses blue color scheme (#0033a0) and Israeli flag emoji (🇮🇱)
- **Responsive breakpoints**: 768px for tablet, 480px for mobile
- **External dependencies**: Only Moment.js for Hebrew date formatting

### Code Patterns

- Uses vanilla JavaScript with DOM manipulation
- Event listeners attached in DOMContentLoaded
- Global state managed through `currentFilter` and `currentSearchTerm` variables
- Error handling with console logging and user-friendly fallback displays