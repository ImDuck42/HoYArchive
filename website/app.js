// --- STATE & CONFIGURATION ---
let characters = [];
let filteredCharacters = [];
let currentFilters = {
    search: '',
    path: '',
    element: ''
};
let activeCharacterCardElement = null; // To store the card that opened the overlay
let focusableElementsInOverlay = []; // For focus trapping

// --- CONSTANTS ---
const KEY_ESCAPE = 'Escape';
const KEY_ENTER = 'Enter';
const KEY_SPACE = ' ';
const KEY_SLASH = '/';
const KEY_TAB = 'Tab';
const DEBOUNCE_DELAY_SEARCH = 300;
const FILTER_APPLY_DELAY = 50;
const OVERLAY_TRANSITION_FALLBACK_DELAY = 400;

// --- DOM ELEMENTS ---
const searchInput = document.getElementById('searchInput');
const pathFilterContainer = document.getElementById('pathFilter');
const elementFilterContainer = document.getElementById('elementFilter');
const clearFiltersBtn = document.getElementById('clearFilters');
const characterGrid = document.getElementById('characterGrid');
const noResults = document.getElementById('noResults');
const loadingOverlay = document.getElementById('loading');

const characterDetailOverlay = document.getElementById('characterDetailOverlay');
const overlayContent = document.getElementById('overlayContent');
const overlayContentWrapper = document.getElementById('overlayContentWrapper');
const overlayCloseBtn = document.getElementById('overlayCloseBtn');


// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    showLoading();
    try {
        await loadCharacters();
        populateDynamicDropdowns();
        initializeEventListeners();
        renderCharacters();
    } catch (error) {
        console.error('Failed to initialize application:', error);
        showError(error.message || 'Failed to load character data. Please try refreshing the page.');
    } finally {
        hideLoading();
    }
});

// --- DYNAMIC DROPDOWN POPULATION ---
function populateDynamicDropdowns() {
    const paths = Array.from(new Set(characters.map(c => c.path).filter(Boolean))).sort();
    const elements = Array.from(new Set(characters.map(c => c.element).filter(Boolean))).sort();

    function buildOptions(options, defaultTextLabel) {
        let html = `<div class="filter-option" role="option" data-value="" data-default-text="${defaultTextLabel}" aria-selected="true">All ${defaultTextLabel}s</div>`;
        options.forEach(opt => {
            html += `<div class="filter-option" role="option" data-value="${opt}" aria-selected="false">${opt}</div>`;
        });
        return html;
    }

    const pathDropdownContent = pathFilterContainer.querySelector('.filter-dropdown-content');
    pathDropdownContent.innerHTML = buildOptions(paths, 'Path');

    const elementDropdownContent = elementFilterContainer.querySelector('.filter-dropdown-content');
    elementDropdownContent.innerHTML = buildOptions(elements, 'Element');

    initializeDropdown(pathFilterContainer, 'path');
    initializeDropdown(elementFilterContainer, 'element');
}

// --- DATA HANDLING ---
async function loadCharacters() {
    try {
        const response = await fetch('website/data.json');
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${response.statusText} while fetching character data.`);
        }
        const data = await response.json();
        characters = Array.isArray(data.characters) ? data.characters : Array.isArray(data) ? data : [];

        if (characters.length === 0) {
            console.warn('Character data loaded, but the array is empty or structure is not as expected.', data);
        }
        filteredCharacters = [...characters];
    } catch (error) {
        console.error('Error loading character data:', error);
        throw error;
    }
}

// --- EVENT LISTENERS ---
function initializeEventListeners() {
    searchInput.addEventListener('input', debounce(handleSearchInput, DEBOUNCE_DELAY_SEARCH));

    [pathFilterContainer, elementFilterContainer].forEach(container => {
        const button = container.querySelector('.filter-button');
        if (button) {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleDropdown(container);
            });
        }
    });

    clearFiltersBtn.addEventListener('click', handleClearFilters);

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.filter-dropdown')) {
            closeAllDropdowns();
        }
    });

    document.addEventListener('keydown', handleGlobalKeyboardShortcuts);

    overlayCloseBtn.addEventListener('click', closeCharacterDetailOverlay);
    characterDetailOverlay.addEventListener('click', (e) => {
        if (e.target === characterDetailOverlay) {
            closeCharacterDetailOverlay();
        }
    });
}

function initializeDropdown(dropdownElement, filterType) {
    const content = dropdownElement.querySelector('.filter-dropdown-content');
    const options = content.querySelectorAll('.filter-option');

    options.forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            handleFilterOptionSelect(dropdownElement, option, filterType);
        });
        option.addEventListener('keydown', (e) => {
            if (e.key === KEY_ENTER || e.key === KEY_SPACE) {
                e.preventDefault();
                e.stopPropagation();
                handleFilterOptionSelect(dropdownElement, option, filterType);
            }
        });
    });
}


// --- FILTERING LOGIC ---
function handleSearchInput(e) {
    currentFilters.search = e.target.value.toLowerCase().trim();
    applyFilters();
}

function handleFilterOptionSelect(dropdownElement, optionElement, filterType) {
    const value = optionElement.dataset.value;
    const button = dropdownElement.querySelector('.filter-button');
    const buttonLabel = button.querySelector('.filter-button-label');
    const allOptionBaseLabel = dropdownElement.querySelector('.filter-option[data-value=""]').dataset.defaultText;
    const baseFilterName = allOptionBaseLabel || filterType.charAt(0).toUpperCase() + filterType.slice(1);

    dropdownElement.querySelectorAll('.filter-option').forEach(opt => {
        opt.classList.remove('selected');
        opt.setAttribute('aria-selected', 'false');
    });
    optionElement.classList.add('selected');
    optionElement.setAttribute('aria-selected', 'true');


    if (buttonLabel) {
        buttonLabel.textContent = value ? `${baseFilterName}: ${value}` : baseFilterName;
    }
    button.setAttribute('aria-expanded', 'false');
    currentFilters[filterType] = value;
    applyFilters();
    closeAllDropdowns();
    button.focus(); // Return focus to the button that opened the dropdown
}

function applyFilters() {
    showLoading();
    setTimeout(() => {
        filteredCharacters = characters.filter(character => {
            const nameMatch = !currentFilters.search || (character.name && character.name.toLowerCase().includes(currentFilters.search));
            const pathMatch = !currentFilters.path || character.path === currentFilters.path;
            const elementMatch = !currentFilters.element || character.element === currentFilters.element;
            return nameMatch && pathMatch && elementMatch;
        });
        renderCharacters();
        hideLoading();
    }, FILTER_APPLY_DELAY);
}

function handleClearFilters() {
    currentFilters = { search: '', path: '', element: '' };
    searchInput.value = '';

    document.querySelectorAll('.filter-dropdown').forEach(dropdown => {
        const filterType = dropdown.id.replace('Filter', '');
        const button = dropdown.querySelector('.filter-button');
        const buttonLabel = button.querySelector('.filter-button-label');
        const allOption = dropdown.querySelector('.filter-option[data-value=""]');
        const defaultText = allOption?.dataset.defaultText || filterType.charAt(0).toUpperCase() + filterType.slice(1);

        if (buttonLabel) {
            buttonLabel.textContent = defaultText;
        }

        dropdown.querySelectorAll('.filter-option.selected').forEach(option => {
            option.classList.remove('selected');
            option.setAttribute('aria-selected', 'false');
        });
        if (allOption) {
            allOption.classList.add('selected');
            allOption.setAttribute('aria-selected', 'true');
        }
    });

    applyFilters();
    closeAllDropdowns();
    searchInput.focus();
}

function toggleDropdown(dropdownElement) {
    const isActive = dropdownElement.classList.contains('active');
    closeAllDropdowns(); // Close others first
    if (!isActive) {
        dropdownElement.classList.add('active');
        dropdownElement.querySelector('.filter-button').setAttribute('aria-expanded', 'true');
        // Focus first option in dropdown
        const firstOption = dropdownElement.querySelector('.filter-option');
        if (firstOption) firstOption.focus();
    }
}

function closeAllDropdowns() {
    document.querySelectorAll('.filter-dropdown.active').forEach(dropdown => {
        dropdown.classList.remove('active');
        dropdown.querySelector('.filter-button').setAttribute('aria-expanded', 'false');
    });
}

// --- RENDERING LOGIC ---
function renderCharacters() {
    if (characters.length === 0) {
        if (!loadingOverlay.style.display || loadingOverlay.style.display === 'none') {
            showError("No characters are available. The dataset might be empty or improperly formatted.");
            if (characterGrid) characterGrid.style.display = 'grid';
            if (noResults) noResults.style.display = 'none';
        }
        return;
    }

    if (filteredCharacters.length === 0) {
        if (characterGrid) characterGrid.innerHTML = '';
        if (characterGrid) characterGrid.style.display = 'none';
        if (noResults) noResults.style.display = 'block';
    } else {
        if (characterGrid) characterGrid.style.display = 'grid';
        if (noResults) noResults.style.display = 'none';
        if (characterGrid) characterGrid.innerHTML = filteredCharacters.map(createCharacterCardHTML).join('');
        addCharacterCardEventListeners();
    }
}

function createCharacterCardHTML(character) {
    const rarityStars = '★'.repeat(character.rarity || 0);
    const charId = character.id || `char-fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const imageSrc = character.assets?.splashImage || `characters/generic/splash.png`; // Generic fallback
    const altText = `Splash art for ${character.name || 'Character'}`;

    return `
        <div class="character-card" data-character-id="${charId}" tabindex="0" aria-label="View details for ${character.name || 'Character'}" role="button">
            <img src="${imageSrc}" alt="${altText}" class="character-image" loading="lazy" onerror="this.onerror=null; this.src='characters/generic/splash_error.png'; this.alt='Failed to load image for ${character.name || 'Character'}';">
            <div class="character-info">
                <h2 class="character-name" id="char-name-${charId}">${character.name || 'Unknown Character'}</h2>
                <div class="character-meta">
                    ${character.rarity ? `<span class="character-badge rarity-badge" aria-label="${character.rarity} star rarity">${rarityStars}</span>` : ''}
                    ${character.element ? `<span class="character-badge element-badge">${character.element}</span>` : ''}
                    ${character.path ? `<span class="character-badge path-badge">${character.path}</span>` : ''}
                </div>
                <p class="character-description">${character.description?.trim()}</p>
            </div>
        </div>
    `;
}

function generateCharacterDetailHTML(character) {
    const characterIdForOverlay = character.id || 'unknown-character';
    let leftPaneContent = `
        <div class="character-modelinfo-main expanded-section">
            <h3>Character Model Info</h3>
            <div class="character-modelinfo">${character.modelInfo?.trim() || 'No background information available.'}</div>
        </div>`;

    const modelDownloadPath = character.assets?.modelDownload || `characters/${character.id}/model.zip`;
    leftPaneContent += `
        <div class="model-contents-section expanded-section">
            <h3>Model Archive Contents</h3>
            <div class="zip-contents-list" id="overlay-zip-contents-${character.id}" aria-live="polite">
                <p class="loading-zip-message">Loading model contents...</p>
            </div>
            <button type="button" class="action-btn download-btn model-download-btn-inline" data-model-path="${modelDownloadPath}" data-character-name="${character.name || 'character'}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" aria-hidden="true"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>
                Download Model
            </button>
        </div>`;

    const hasAdditionalDetails = character.meta?.voiceActor || character.meta?.uploadDate || character.meta?.uploader;
    if (hasAdditionalDetails) {
        let uploaderHtml = '';
        if (character.meta?.uploader) {
            const uploaderStr = character.meta.uploader;
            const ownerEmoji = '💩';
            const ownerTooltip = 'Shite Ownah';
            if (/\bhu7ao\b/i.test(uploaderStr)) { // \b for word boundaries
                uploaderHtml = `<p><strong>Uploader:</strong> ${uploaderStr} <span class="owner-indicator" title="${ownerTooltip}" aria-label="${ownerTooltip}">${ownerEmoji}</span></p>`;
            } else {
                uploaderHtml = `<p><strong>Uploader:</strong> ${uploaderStr}</p>`;
            }
        }
        leftPaneContent += `
        <div class="character-additional-details expanded-section">
            <h3>Uploader & Additional Details</h3>
            ${uploaderHtml}
            ${character.meta?.voiceActor ? `<p><strong>Voice Actor:</strong> ${character.meta.voiceActor}</p>` : ''}
            ${character.meta?.uploadDate ? `<p><strong>Upload Date:</strong> ${character.meta.uploadDate}</p>` : ''}
        </div>`;
    }

    let rightPaneContent = '';
    if (character.inclusions && character.inclusions.length > 0) {
        rightPaneContent = `
        <div class="inclusions-section expanded-section">
            <h3>Inclusions List</h3>
            ${character.inclusions.map(info => {
                const inclusionDesc = info.description?.trim();
                const inclusionName = info.name?.trim() || 'Unnamed Inclusion';
                return `
                <div class="inclusion">
                    <div class="inclusion-header">
                        ${info.id ? `<span class="inclusion-id">${info.id}</span>` : ''}
                        <span class="inclusion-name">${inclusionName}</span>
                    </div>
                    <p class="inclusion-description">${inclusionDesc}</p>
                </div>
            `}).join('')}
        </div>`;
    }

    return `
        <h2 class="character-name-overlay" id="overlayCharName-${characterIdForOverlay}">${character.name || 'Unknown Character'}</h2>
        
        <div class="expanded-content-grid">
            <div class="expanded-left-column">
                ${leftPaneContent}
            </div>
            <div class="expanded-right-column">
                ${rightPaneContent}
            </div>
        </div>
    `;
}

// --- CARD & OVERLAY INTERACTION ---
function addCharacterCardEventListeners() {
    characterGrid.querySelectorAll('.character-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (e.target.closest('a, button')) return; // Ignore clicks on interactive elements within
            showCharacterDetailOverlay(this.dataset.characterId, this);
        });

        card.addEventListener('keydown', function(e) {
            if (e.key === KEY_ENTER || e.key === KEY_SPACE) {
                if (e.target.closest('a, button')) return;
                e.preventDefault();
                showCharacterDetailOverlay(this.dataset.characterId, this);
            }
        });
        // card.dataset.eventsAttached = 'true';
    });
}

function showCharacterDetailOverlay(characterId, cardElement) {
    const character = characters.find(c => String(c.id) === String(characterId));
    if (!character) {
        console.warn(`Character with ID ${characterId} not found.`);
        showNotification(`Could not load details for character ID ${characterId}.`, 'error');
        return;
    }

    activeCharacterCardElement = cardElement;

    const characterIdForOverlay = character.id || 'unknown-character';
    overlayContent.innerHTML = generateCharacterDetailHTML(character);
    characterDetailOverlay.setAttribute('aria-labelledby', `overlayCharName-${characterIdForOverlay}`);

    executeScriptsInElement(overlayContent);

    characterDetailOverlay.hidden = false;
    requestAnimationFrame(() => {
        characterDetailOverlay.classList.add('active');
    });

    disableBodyScroll();
    setupFocusTrap();

    let modelDownloadPath = character.assets?.modelDownload || `characters/${character.id}/model.zip`;
    const zipContentsContainer = overlayContent.querySelector(`#overlay-zip-contents-${character.id}`);
    if (zipContentsContainer) {
        loadAndDisplayZipContents(modelDownloadPath, zipContentsContainer);
    }
    const downloadBtn = overlayContent.querySelector('.download-btn[data-model-path]');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            handleDownloadModel(modelDownloadPath, downloadBtn.dataset.characterName);
        });
    }

    overlayCloseBtn.focus();
    characterDetailOverlay.setAttribute('aria-hidden', 'false');
}

function executeScriptsInElement(element) {
    if (!element) return;
    const scripts = element.querySelectorAll('script');
    scripts.forEach(oldScript => {
        const newScript = document.createElement('script');
        for (const attr of oldScript.attributes) {
            newScript.setAttribute(attr.name, attr.value);
        }
        newScript.textContent = oldScript.textContent;
        if (oldScript.parentNode) {
            oldScript.parentNode.replaceChild(newScript, oldScript);
        }
    });
}

function closeCharacterDetailOverlay() {
    characterDetailOverlay.classList.remove('active');
    characterDetailOverlay.setAttribute('aria-hidden', 'true');

    characterDetailOverlay.addEventListener('transitionend', performOverlayCloseActions, { once: true });
    setTimeout(() => { // Fallback
        if (!characterDetailOverlay.hidden) {
            performOverlayCloseActions();
        }
    }, OVERLAY_TRANSITION_FALLBACK_DELAY);
}

function performOverlayCloseActions() {
    if (characterDetailOverlay.classList.contains('active')) return;

    characterDetailOverlay.hidden = true;
    overlayContent.innerHTML = '';

    removeFocusTrap();
    enableBodyScroll();

    if (activeCharacterCardElement) {
        activeCharacterCardElement.focus();
        activeCharacterCardElement = null;
    }
}


// --- FOCUS TRAPPING for Overlay ---
function setupFocusTrap() {
    focusableElementsInOverlay = []; // Reset
    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    if (overlayContent.getAttribute('tabindex') !== "-1") {
        // overlayContent.setAttribute('tabindex', "-1");
    }

    let allFocusable = Array.from(characterDetailOverlay.querySelectorAll(focusableSelector));
    // Filter for only visible and actually focusable elements
    focusableElementsInOverlay = allFocusable.filter(
        el => el.offsetParent !== null && !el.disabled && el.getAttribute('tabindex') !== "-1"
    );
    // Add event listener for tabbing within the overlay
    characterDetailOverlay.addEventListener('keydown', trapFocusHandler);
}

function removeFocusTrap() {
    characterDetailOverlay.removeEventListener('keydown', trapFocusHandler);
    focusableElementsInOverlay = [];
}

function trapFocusHandler(e) {
    if (e.key !== KEY_TAB || focusableElementsInOverlay.length === 0) {
        return;
    }

    const firstFocusableElement = focusableElementsInOverlay[0];
    const lastFocusableElement = focusableElementsInOverlay[focusableElementsInOverlay.length - 1];

    if (e.shiftKey) { // Shift + Tab
        if (document.activeElement === firstFocusableElement) {
            lastFocusableElement.focus();
            e.preventDefault();
        }
    } else { // Tab
        if (document.activeElement === lastFocusableElement) {
            firstFocusableElement.focus();
            e.preventDefault();
        }
    }
}


// --- ZIP & DOWNLOAD LOGIC ---
async function loadAndDisplayZipContents(zipPath, containerElement) {
    if (!containerElement) return;

    if (typeof JSZip === 'undefined') {
        containerElement.innerHTML = `<p class="error-zip-message">File listing library (JSZip) not loaded. Please ensure you are connected to the internet or the library is correctly included.</p>`;
        containerElement.dataset.loaded = 'error';
        return;
    }

    containerElement.innerHTML = '<p class="loading-zip-message">Fetching model file list...</p>';
    containerElement.dataset.loaded = 'loading';

    try {
        const response = await fetch(zipPath);
        if (!response.ok) {
            throw new Error(`Failed to fetch ZIP: ${response.status} ${response.statusText}`);
        }
        const blob = await response.blob();

        if (!["application/zip", "application/x-zip-compressed", "application/octet-stream", ""].includes(blob.type.toLowerCase()) && blob.type) {
            console.warn(`File at ${zipPath} has unexpected MIME type: '${blob.type}'. Attempting to process as ZIP.`);
        }

        const zip = await JSZip.loadAsync(blob);
        const fileListElement = document.createElement('ul');
        fileListElement.setAttribute('aria-label', 'Files in the model ZIP archive');

        let fileCount = 0;
        for (const filename in zip.files) {
            if (Object.prototype.hasOwnProperty.call(zip.files, filename) && !zip.files[filename].dir) {
                const listItem = document.createElement('li');
                listItem.textContent = filename;
                fileListElement.appendChild(listItem);
                fileCount++;
            }
        }

        containerElement.innerHTML = '';
        if (fileCount === 0) {
            containerElement.innerHTML = '<p class="zip-empty-message">This model ZIP file is empty or contains only folders.</p>';
        } else {
            containerElement.appendChild(fileListElement);
        }
        containerElement.dataset.loaded = 'true';

    } catch (error) {
        console.error(`Error loading ZIP contents from ${zipPath}:`, error);
        containerElement.innerHTML = `<p class="error-zip-message">Could not load model contents. (${error.message})</p>`;
        containerElement.dataset.loaded = 'error';
    }
}

function handleDownloadModel(modelPath, characterName) {
    let character = characters.find(
        c => c.name && characterName && c.name.toLowerCase() === characterName.toLowerCase()
    );
    if (!character && characters.length > 0) character = characters[0]; // Fallback to first char.
    const charId = character?.id || 'unknown_character';

    const finalModelPath = modelPath || `characters/${charId}/${charId}.zip`;

    if (!finalModelPath || !characterName) {
        showNotification('Download information is missing or incomplete.', 'error');
        return;
    }
    try {
        const link = document.createElement('a');
        link.href = finalModelPath;
        const safeCharacterName = characterName.toLowerCase().replace(/\s+/g, '_').replace(/[^\w.-]/g, '');
        // Using character ID for filename
        link.download = `${safeCharacterName}_${charId}.zip`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification(`Downloading ${characterName}'s model...`, 'success');
    } catch (error) {
        console.error('Download initiation failed:', error);
        showNotification('Download could not be started. Check console for errors.', 'error');
    }
}

// --- GLOBAL KEYBOARD SHORTCUTS ---
function handleGlobalKeyboardShortcuts(e) {
    if (e.key === KEY_ESCAPE) {
        if (!characterDetailOverlay.hidden) {
            closeCharacterDetailOverlay();
        } else if (document.querySelector('.filter-dropdown.active')) {
            closeAllDropdowns();
        }
    }

    const activeElementTag = document.activeElement ? document.activeElement.tagName : null;
    if (e.key === KEY_SLASH &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElementTag) &&
        characterDetailOverlay.hidden) {
        e.preventDefault();
        searchInput.focus();
    }
}

// --- UTILITIES ---
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showLoading() {
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    if (loadingOverlay) loadingOverlay.style.display = 'none';
}

function showError(message) {
    if (characterGrid) {
        characterGrid.innerHTML = `
            <div class="error-message-container">
                <h2>Error Encountered</h2>
                <p>${message}</p>
            </div>`;
        if (characterGrid) characterGrid.style.display = 'grid';
        if (noResults) noResults.style.display = 'none';
    } else {
        console.error("Critical: characterGrid DOM element not found. Cannot display error in grid.");
        alert(`Error: ${message}`);
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.setAttribute('role', type === 'error' || type === 'success' ? 'alert' : 'status');
    notification.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    notification.textContent = message;

    document.body.appendChild(notification);

    requestAnimationFrame(() => {
        notification.classList.add('visible');
    });

    setTimeout(() => {
        notification.classList.remove('visible');
        notification.addEventListener('transitionend', () => notification.remove(), { once: true });
    }, 3500);
}


const getScrollbarWidth = (() => {
    let scrollbarWidth = null;
    return () => {
        if (scrollbarWidth === null) {
            const scrollDiv = document.createElement('div');
            Object.assign(scrollDiv.style, {
                width: '100px',
                height: '100px',
                overflow: 'scroll',
                position: 'absolute',
                top: '-9999px'
            });
            document.body.appendChild(scrollDiv);
            scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;
            document.body.removeChild(scrollDiv);
        }
        return scrollbarWidth;
    };
})();


function disableBodyScroll() {
    const currentScrollbarWidth = getScrollbarWidth();
    if (parseFloat(document.body.style.paddingRight || 0) < currentScrollbarWidth ) {
         document.body.style.paddingRight = `${currentScrollbarWidth}px`;
    }
    document.body.style.overflow = 'hidden';
}

function enableBodyScroll() {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
}