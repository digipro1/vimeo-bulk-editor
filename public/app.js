const appContainer = document.getElementById('app-container');
const folderFilter = document.getElementById('folder-filter');
const tableContainer = document.getElementById('table-container');
const videoTbody = document.getElementById('video-list');
const saveAllBtn = document.getElementById('save-all-btn');
const manageFolderBtn = document.getElementById('manage-folder-btn');
// We need to re-declare the bulk edit variables that were temporarily removed
const bulkEditBar = document.getElementById('bulk-edit-bar');
const selectionCounter = document.getElementById('selection-counter');
const selectAllCheckbox = document.getElementById('select-all-checkbox');

let currentUser = null;
let originalVideoData = new Map();
let selectedVideoIds = new Set(); // Re-add set for selected videos

// --- RENDER TABLE (FIXED) ---
// Restores the checkbox column and correctly adds event listeners.
const renderTable = (videos) => {
    videoTbody.innerHTML = '';
    originalVideoData.clear();
    saveAllBtn.style.display = 'none';
    manageFolderBtn.style.display = 'none';

    // **FIX**: The colspan should be 8 to match the header.
    if (videos.length === 0) {
        videoTbody.innerHTML = '<tr><td colspan="8">No videos found in this folder.</td></tr>';
        return;
    }

    const privacyOptions = ['anybody', 'unlisted', 'password', 'nobody'];
    videos.forEach(video => {
        const videoId = video.uri.split('/').pop();
        originalVideoData.set(videoId, {
            name: video.name || '',
            description: video.description || '',
            tags: video.tags.map(tag => tag.name).join(', '),
            privacy: video.privacy.view,
        });
        const row = document.createElement('tr');
        row.dataset.videoId = videoId;
        const privacyDropdown = `<select class="privacy-select">${privacyOptions.map(opt => `<option value="${opt}" ${video.privacy.view === opt ? 'selected' : ''}>${opt.charAt(0).toUpperCase() + opt.slice(1)}</option>`).join('')}</select>`;
        
        // **FIX**: The checkbox <td> is now restored at the beginning of the row.
        row.innerHTML = `
            <td><input type="checkbox" class="video-checkbox" data-video-id="${videoId}"></td>
            <td class="video-title" contenteditable="true">${video.name || ''}</td>
            <td class="video-description" contenteditable="true">${video.description || ''}</td>
            <td class="video-tags" contenteditable="true">${video.tags.map(tag => tag.name).join(', ')}</td>
            <td>${privacyDropdown}</td>
            <td>${video.status}</td>
            <td><a href="https://vimeo.com/manage/videos/${videoId}" target="_blank" class="manage-link">Manage</a></td>
            <td><button class="save-btn">Save</button></td>
        `;
        videoTbody.appendChild(row);
        // Add listeners for the row's save button and new checkbox
        row.querySelector('.save-btn').addEventListener('click', (e) => handleSave(e, currentUser));
        row.querySelector('.video-checkbox').addEventListener('change', handleSelectionChange);
    });

    saveAllBtn.style.display = 'inline-block';
    manageFolderBtn.style.display = 'inline-block';
    // Clear any previous selections and update the bulk edit UI
    selectedVideoIds.clear();
    updateBulkEditUI();
};


// --- FETCH VIDEOS BY FOLDER (FIXED) ---
// Corrects the colspan to 8 for loading messages.
const fetchVideosByFolder = async () => {
    const selectedFolderUri = folderFilter.value;
    if (!selectedFolderUri) {
        tableContainer.style.display = 'none';
        videoTbody.innerHTML = '';
        saveAllBtn.style.display = 'none';
        manageFolderBtn.style.display = 'none';
        return;
    }

    tableContainer.style.display = 'block';
    // **FIX**: The colspan should be 8 to match the header.
    videoTbody.innerHTML = `<tr><td colspan="8">Fetching videos from folder...</td></tr>`;
    folderFilter.disabled = true;
    saveAllBtn.style.display = 'none';
    manageFolderBtn.style.display = 'none';

    try {
        const response = await fetch(`/api/vimeo?folderUri=${encodeURIComponent(selectedFolderUri)}`, {
            headers: { Authorization: `Bearer ${currentUser.token.access_token}` },
        });
        if (!response.ok) throw new Error((await response.json()).error);
        const { data } = await response.json();
        renderTable(data);
    } catch (error) {
        videoTbody.innerHTML = `<tr><td colspan="8" style="color: red;">Error: ${error.message}</td></tr>`;
    } finally {
        folderFilter.disabled = false;
    }
};

// --- All other functions (fetchFolders, handleSave, etc.) are included below ---
// --- They are the same as the versions that included the bulk edit logic. ---

const fetchFolders = async (user) => {
    try {
        let allFolders = [];
        let nextPagePath = null;
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
        defaultOption.value = "";
        defaultOption.textContent = "Select a folder...";
        defaultOption.selected = true;
        defaultOption.disabled = true;
        folderFilter.appendChild(defaultOption);
        if (allFolders.length > 0) {
            allFolders.sort((a, b) => a.name.localeCompare(b.name));
            allFolders.forEach(folder => {
                const option = document.createElement('option');
                option.value = folder.uri;
                option.textContent = folder.name;
                option.dataset.link = folder.link; 
                folderFilter.appendChild(option);
            });
        }
        folderFilter.disabled = false;
    } catch (error) {
        folderFilter.innerHTML = `<option>Error loading folders</option>`;
        console.error(error);
    }
};

const handleSave = async (event, user) => {
    const saveButton = event.target;
    const row = saveButton.closest('tr');
    const videoId = row.dataset.videoId;
    saveButton.textContent = 'Saving...';
    saveButton.disabled = true;
    const selectedPrivacy = row.querySelector('.privacy-select').value;
    const updates = {
        name: row.querySelector('.video-title').textContent,
        description: row.querySelector('.video-description').textContent,
        tags: row.querySelector('.video-tags').textContent,
        privacy: { view: selectedPrivacy }
    };
    try {
        const response = await fetch('/api/update-video', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token.access_token}` },
            body: JSON.stringify({ videoId, updates }),
        });
        if (!response.ok) throw new Error((await response.json()).error);
        saveButton.textContent = 'Saved!';
        originalVideoData.set(videoId, { name: updates.name, description: updates.description, tags: updates.tags, privacy: updates.privacy.view });
        setTimeout(() => { saveButton.textContent = 'Save'; }, 2000);
    } catch (error) {
        alert(`Error saving video: ${error.message}`);
        saveButton.textContent = 'Retry';
    } finally {
        saveButton.disabled = false;
    }
};

// All the bulk edit logic is now restored
const updateBulkEditUI = () => {
    const selectedCount = selectedVideoIds.size;
    if (selectedCount > 0) {
        bulkEditBar.style.display = 'block';
        selectionCounter.textContent = `${selectedCount} video(s) selected`;
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
    const changedRows = [];
    const allRows = videoTbody.querySelectorAll('tr');
    allRows.forEach(row => {
        const videoId = row.dataset.videoId;
        if (!videoId) return;
        const original = originalVideoData.get(videoId);
        const current = {
            name: row.querySelector('.video-title').textContent,
            description: row.querySelector('.video-description').textContent,
            tags: row.querySelector('.video-tags').textContent,
            privacy: row.querySelector('.privacy-select').value,
        };
        if (original.name !== current.name || original.description !== current.description || original.tags !== current.tags || original.privacy !== current.privacy) {
            changedRows.push({ videoId, updates: { name: current.name, description: current.description, tags: current.tags, privacy: { view: current.privacy } } });
        }
    });
    if (changedRows.length === 0) {
        alert('No changes to save.');
        return;
    }
    saveAllBtn.textContent = 'Saving...';
    saveAllBtn.disabled = true;
    folderFilter.disabled = true;
    manageFolderBtn.disabled = true;
    let successCount = 0;
    for (let i = 0; i < changedRows.length; i++) {
        const { videoId, updates } = changedRows[i];
        saveAllBtn.textContent = `Saving ${i + 1} of ${changedRows.length}...`;
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
    alert(`Saved ${successCount} of ${changedRows.length} changed videos.`);
    saveAllBtn.textContent = 'Save All Changes';
    saveAllBtn.disabled = false;
    folderFilter.disabled = false;
    manageFolderBtn.disabled = false;
    await fetchVideosByFolder();
};

const handleManageFolder = () => {
    const selectedOption = folderFilter.options[folderFilter.selectedIndex];
    const folderLink = selectedOption.dataset.link;
    if (folderLink) {
        window.open(folderLink, '_blank');
    } else {
        alert('Could not find the link for the selected folder.');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    folderFilter.addEventListener('change', fetchVideosByFolder);
    saveAllBtn.addEventListener('click', handleSaveAll);
    manageFolderBtn.addEventListener('click', handleManageFolder);
    selectAllCheckbox.addEventListener('click', () => {
        const allCheckboxes = document.querySelectorAll('.video-checkbox');
        allCheckboxes.forEach(checkbox => {
            checkbox.checked = selectAllCheckbox.checked;
            handleSelectionChange({ target: checkbox }); // Manually trigger change handler
        });
    });

    netlifyIdentity.on('login', (user) => {
        currentUser = user;
        appContainer.style.display = 'block';
        fetchFolders(user);
    });
    netlifyIdentity.on('logout', () => {
        currentUser = null;
        appContainer.style.display = 'none';
        tableContainer.style.display = 'none';
        saveAllBtn.style.display = 'none';
        manageFolderBtn.style.display = 'none';
        bulkEditBar.style.display = 'none';
    });
    const user = netlifyIdentity.currentUser();
    if (user) {
        currentUser = user;
        appContainer.style.display = 'block';
        fetchFolders(user);
    }
});
