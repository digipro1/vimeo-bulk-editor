const appContainer = document.getElementById('app-container');
const folderFilter = document.getElementById('folder-filter');
const tableContainer = document.getElementById('table-container');
const videoTbody = document.getElementById('video-list');
const saveAllBtn = document.getElementById('save-all-btn');
const manageFolderBtn = document.getElementById('manage-folder-btn');
const bulkEditBar = document.getElementById('bulk-edit-bar');
const selectionCounter = document.getElementById('selection-counter');
const selectAllCheckbox = document.getElementById('select-all-checkbox');
const applyBulkEditBtn = document.getElementById('apply-bulk-edit-btn');
const tableHeader = document.querySelector('#video-table thead'); // NEW: Get the table header for clicks

let currentUser = null;
let originalVideoData = new Map();
let selectedVideoIds = new Set(); 
let currentVideos = []; // NEW: To hold the currently displayed video data for sorting
let sortState = { column: null, direction: 'asc' }; // NEW: To track sorting state

// --- NEW: SORTING FUNCTIONS ---
const updateSortIcons = () => {
    document.querySelectorAll('.sortable-header').forEach(header => {
        header.classList.remove('sorted-asc', 'sorted-desc');
        if (header.dataset.sortKey === sortState.column) {
            header.classList.add(sortState.direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
        }
    });
};

const sortVideos = (key) => {
    if (sortState.column === key) {
        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortState.column = key;
        sortState.direction = 'asc';
    }

    currentVideos.sort((a, b) => {
        let valA, valB;
        if (key === 'privacy') {
            valA = a.privacy.view;
            valB = b.privacy.view;
        } else {
            valA = a[key];
            valB = b[key];
        }
        
        let comparison = 0;
        if (typeof valA === 'number' && typeof valB === 'number') {
            comparison = valA - valB; // Numerical sort for duration
        } else {
            valA = String(valA || '').toLowerCase();
            valB = String(valB || '').toLowerCase();
            comparison = valA.localeCompare(valB); // Alphabetical sort for strings
        }
        return sortState.direction === 'asc' ? comparison : -comparison;
    });

    renderTable(currentVideos); // Re-render the table with sorted data
};

// --- RENDER TABLE (UPDATED) ---
const renderTable = (videos) => {
    videoTbody.innerHTML = '';
    
    // Check if this is a fresh render or a re-sort
    const isNewData = videos !== currentVideos;
    if (isNewData) {
        originalVideoData.clear();
        currentVideos = videos; // Update the global array with the new data
    }

    if (videos.length === 0) {
        videoTbody.innerHTML = '<tr><td colspan="9">No videos found in this folder.</td></tr>';
        saveAllBtn.style.display = 'none';
        manageFolderBtn.style.display = 'none';
        return;
    }

    const privacyOptions = ['anybody', 'unlisted', 'password', 'nobody'];
    videos.forEach(video => {
        const videoId = video.uri.split('/').pop();
        if (isNewData) {
            originalVideoData.set(videoId, {
                name: video.name || '', description: video.description || '',
                tags: video.tags.map(tag => tag.name).join(', '), privacy: video.privacy.view,
            });
        }
        const row = document.createElement('tr');
        row.dataset.videoId = videoId;
        const privacyDropdown = `<select class="privacy-select">${privacyOptions.map(opt => `<option value="${opt}" ${video.privacy.view === opt ? 'selected' : ''}>${opt.charAt(0).toUpperCase() + opt.slice(1)}</option>`).join('')}</select>`;
        row.innerHTML = `
            <td><input type="checkbox" class="video-checkbox" data-video-id="${videoId}"></td>
            <td class="video-title" contenteditable="true">${video.name || ''}</td>
            <td class="video-description" contenteditable="true">${video.description || ''}</td>
            <td class="video-tags" contenteditable="true">${video.tags.map(tag => tag.name).join(', ')}</td>
            <td>${privacyDropdown}</td>
            <td>${video.status}</td>
            <td>${formatDuration(video.duration)}</td>
            <td><a href="https://vimeo.com/manage/videos/${videoId}" target="_blank" class="manage-link">Manage</a></td>
            <td><button class="save-btn">Save</button></td>
        `;
        videoTbody.appendChild(row);
        row.querySelector('.save-btn').addEventListener('click', (e) => handleSave(e, currentUser));
        row.querySelector('.video-checkbox').addEventListener('change', handleSelectionChange);
    });

    saveAllBtn.style.display = 'inline-block';
    manageFolderBtn.style.display = 'inline-block';
    selectedVideoIds.clear();
    updateBulkEditUI();
    updateSortIcons(); // NEW: Update icons after rendering
};

// --- FETCH VIDEOS BY FOLDER (UPDATED) ---
const fetchVideosByFolder = async () => {
    const selectedFolderUri = folderFilter.value;
    if (!selectedFolderUri) {
        tableContainer.style.display = 'none'; videoTbody.innerHTML = ''; saveAllBtn.style.display = 'none'; manageFolderBtn.style.display = 'none'; if(bulkEditBar) bulkEditBar.style.display = 'none'; return;
    }
    tableContainer.style.display = 'block';
    videoTbody.innerHTML = `<tr><td colspan="9">Fetching videos from folder...</td></tr>`;
    folderFilter.disabled = true; saveAllBtn.style.display = 'none'; manageFolderBtn.style.display = 'none'; if(bulkEditBar) bulkEditBar.style.display = 'none';

    try {
        const response = await fetch(`/api/vimeo?folderUri=${encodeURIComponent(selectedFolderUri)}`, {
            headers: { Authorization: `Bearer ${currentUser.token.access_token}` },
        });
        if (!response.ok) throw new Error((await response.json()).error);
        const { data } = await response.json();
        sortState = { column: null, direction: 'asc' }; // Reset sort state on new folder load
        renderTable(data);
    } catch (error) {
        videoTbody.innerHTML = `<tr><td colspan="9" style="color: red;">Error: ${error.message}</td></tr>`;
    } finally {
        folderFilter.disabled = false;
    }
};

// --- ALL OTHER FUNCTIONS AND LISTENERS ARE HERE, UNCHANGED ---
const formatDuration = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const paddedSecs = String(secs).padStart(2, '0');
    const paddedMins = String(minutes).padStart(2, '0');
    if (hours > 0) return `${hours}:${paddedMins}:${paddedSecs}`;
    return `${minutes}:${paddedSecs}`;
};
const parseTags = (tagString) => {
    return tagString.split(/[\s,]+/).map(tag => tag.trim()).filter(Boolean);
};
const handleSave = async (event, user) => {
    const saveButton = event.target;
    const row = saveButton.closest('tr');
    const videoId = row.dataset.videoId;
    saveButton.textContent = 'Saving...';
    saveButton.disabled = true;
    const tagsArray = parseTags(row.querySelector('.video-tags').textContent);
    const updates = {
        name: row.querySelector('.video-title').textContent,
        description: row.querySelector('.video-description').textContent,
        tags: tagsArray,
        privacy: { view: row.querySelector('.privacy-select').value }
    };
    try {
        const response = await fetch('/api/update-video', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token.access_token}` },
            body: JSON.stringify({ videoId, updates }),
        });
        if (!response.ok) throw new Error((await response.json()).error);
        saveButton.textContent = 'Saved!';
        originalVideoData.set(videoId, { ...updates, tags: updates.tags.join(', '), privacy: updates.privacy.view });
        setTimeout(() => { saveButton.textContent = 'Save'; }, 2000);
    } catch (error) {
        alert(`Error saving video: ${error.message}`);
        saveButton.textContent = 'Retry';
    } finally {
        saveButton.disabled = false;
    }
};
const fetchFolders = async (user) => {
    try {
        let allFolders = []; let nextPagePath = null;
        do {
            const fetchUrl = nextPagePath ? `/api/get-folders?page=${encodeURIComponent(nextPagePath)}` : '/api/get-folders';
            const response = await fetch(fetchUrl, { headers: { Authorization: `Bearer ${user.token.access_token}` } });
            if (!response.ok) throw new Error((await response.json()).error);
            const pageData = await response.json();
            allFolders = allFolders.concat(pageData.folders);
            nextPagePath = pageData.nextPagePath;
        } while (nextPagePath);
        folderFilter.innerHTML = '';
        const defaultOption = document.createElement('option');
        defaultOption.value = ""; defaultOption.textContent = "Select a folder..."; defaultOption.selected = true; defaultOption.disabled = true;
        folderFilter.appendChild(defaultOption);
        if (allFolders.length > 0) {
            allFolders.sort((a, b) => a.name.localeCompare(b.name));
            allFolders.forEach(folder => {
                const option = document.createElement('option');
                option.value = folder.uri; option.textContent = folder.name; option.dataset.link = folder.link; 
                folderFilter.appendChild(option);
            });
        }
        folderFilter.disabled = false;
    } catch (error) {
        folderFilter.innerHTML = `<option>Error loading folders</option>`; console.error(error);
    }
};
const updateBulkEditUI = () => {
    const selectedCount = selectedVideoIds.size;
    if (selectedCount > 0) {
        bulkEditBar.style.display = 'block'; selectionCounter.textContent = `${selectedCount} video(s) selected`;
    } else {
        bulkEditBar.style.display = 'none';
    }
    const totalCheckboxes = document.querySelectorAll('.video-checkbox').length;
    selectAllCheckbox.checked = totalCheckboxes > 0 && selectedCount === totalCheckboxes;
};
const handleSelectionChange = (event) => {
    const checkbox = event.target;
    const videoId = checkbox.dataset.videoId;
    if (checkbox.checked) {
        selectedVideoIds.add(videoId);
    } else {
        selectedVideoIds.delete(videoId);
    }
    updateBulkEditUI();
};
const handleSaveAll = async () => {
    const changedRowsData = [];
    const allRows = videoTbody.querySelectorAll('tr');
    allRows.forEach(row => {
        const videoId = row.dataset.videoId;
        if (!videoId) return;
        const original = originalVideoData.get(videoId);
        const currentCleanTags = parseTags(row.querySelector('.video-tags').textContent);
        const current = {
            name: row.querySelector('.video-title').textContent,
            description: row.querySelector('.video-description').textContent,
            tags: currentCleanTags.join(', '),
            privacy: row.querySelector('.privacy-select').value,
        };
        if (original.name !== current.name || original.description !== current.description || original.tags !== current.tags || original.privacy !== current.privacy) {
            changedRowsData.push({ videoId, updates: { ...current, tags: currentCleanTags, privacy: { view: current.privacy } } });
        }
    });
    if (changedRowsData.length === 0) {
        alert('No changes to save.');
        return;
    }
    saveAllBtn.textContent = 'Saving...';
    saveAllBtn.disabled = true;
    let successCount = 0;
    for (let i = 0; i < changedRowsData.length; i++) {
        const { videoId, updates } = changedRowsData[i];
        saveAllBtn.textContent = `Saving ${i + 1} of ${changedRowsData.length}...`;
        try {
            const response = await fetch('/api/update-video', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token.access_token}` },
                body: JSON.stringify({ videoId, updates }),
            });
            if (response.ok) successCount++;
        } catch (error) {
            console.error(`Failed to save video ${videoId}:`, error);
        }
    }
    alert(`Saved ${successCount} of ${changedRowsData.length} changed videos.`);
    saveAllBtn.textContent = 'Save All Changes';
    await fetchVideosByFolder();
};
const handleBulkUpdate = async () => {
    const bulkPrivacy = document.getElementById('bulk-privacy').value;
    const bulkTagsValue = document.getElementById('bulk-tags').value;
    if (selectedVideoIds.size === 0) return;
    if (!bulkPrivacy && !bulkTagsValue) {
        alert('Please choose a privacy setting or enter tags to apply in the bulk edit bar.');
        return;
    }
    const bulkUpdates = {};
    if (bulkPrivacy) {
        bulkUpdates.privacy = { view: bulkPrivacy };
    }
    if (bulkTagsValue) {
        bulkUpdates.tags = parseTags(bulkTagsValue);
    }
    applyBulkEditBtn.textContent = 'Updating...';
    applyBulkEditBtn.disabled = true;
    let count = 0;
    for (const videoId of selectedVideoIds) {
        count++;
        selectionCounter.textContent = `Updating ${count} of ${selectedVideoIds.size}...`;
        try {
            await fetch('/api/update-video', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token.access_token}` },
                body: JSON.stringify({ videoId, updates: bulkUpdates }),
            });
        } catch (error) {
            console.error(`Error updating video ${videoId}:`, error);
        }
    }
    alert('Bulk update complete!');
    applyBulkEditBtn.textContent = 'Apply to Selected';
    await fetchVideosByFolder();
};
const handleManageFolder = () => {
    const selectedOption = folderFilter.options[folderFilter.selectedIndex];
    const folderLink = selectedOption.dataset.link;
    if (folderLink) {
        window.open(folderLink, '_blank');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // NEW: Add event listener for the whole table header
    tableHeader.addEventListener('click', (event) => {
        const header = event.target.closest('.sortable-header');
        if (header) {
            sortVideos(header.dataset.sortKey);
        }
    });

    folderFilter.addEventListener('change', fetchVideosByFolder);
    saveAllBtn.addEventListener('click', handleSaveAll);
    manageFolderBtn.addEventListener('click', handleManageFolder);
    applyBulkEditBtn.addEventListener('click', handleBulkUpdate);
    selectAllCheckbox.addEventListener('click', () => {
        const allCheckboxes = document.querySelectorAll('.video-checkbox');
        if (selectAllCheckbox.checked) {
            allCheckboxes.forEach(checkbox => {
                checkbox.checked = true;
                selectedVideoIds.add(checkbox.dataset.videoId);
            });
        } else {
            allCheckboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            selectedVideoIds.clear();
        }
        updateBulkEditUI();
    });
    netlifyIdentity.on('login', (user) => {
        currentUser = user; appContainer.style.display = 'block'; fetchFolders(user);
    });
    netlifyIdentity.on('logout', () => {
        currentUser = null; appContainer.style.display = 'none'; tableContainer.style.display = 'none'; saveAllBtn.style.display = 'none'; manageFolderBtn.style.display = 'none'; if (bulkEditBar) bulkEditBar.style.display = 'none';
    });
    const user = netlifyIdentity.currentUser();
    if (user) {
        currentUser = user; appContainer.style.display = 'block'; fetchFolders(user);
    }
});
