// Define variables for elements we will need to access.
const appContainer = document.getElementById('app-container');
const folderFilter = document.getElementById('folder-filter');
const tableContainer = document.getElementById('table-container');
const videoTbody = document.getElementById('video-list');
const bulkEditBar = document.getElementById('bulk-edit-bar');
const selectionCounter = document.getElementById('selection-counter');
const selectAllCheckbox = document.getElementById('select-all-checkbox');
const applyBulkEditBtn = document.getElementById('apply-bulk-edit-btn');

// This will hold the logged-in user's information.
let currentUser = null;
let selectedVideoIds = new Set();


// --- All of our functions go here ---

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

const handleBulkUpdate = async () => {
    const bulkPrivacy = document.getElementById('bulk-privacy').value;
    const bulkTags = document.getElementById('bulk-tags').value;
    if (!bulkPrivacy && !bulkTags) {
        alert('Please choose a privacy setting or enter tags to apply.');
        return;
    }
    const updates = {};
    if (bulkPrivacy) {
        updates.privacy = { view: bulkPrivacy };
    }
    applyBulkEditBtn.textContent = 'Updating...';
    applyBulkEditBtn.disabled = true;
    let count = 0;
    const videoRows = Array.from(videoTbody.querySelectorAll('tr'));
    for (const videoId of selectedVideoIds) {
        count++;
        selectionCounter.textContent = `Updating ${count} of ${selectedVideoIds.size}...`;
        const row = videoRows.find(r => r.dataset.videoId === videoId);
        if (!row) continue;
        let finalUpdates = { ...updates };
        if (bulkTags) {
            const currentTags = row.querySelector('.video-tags').textContent;
            const existingTags = currentTags.split(',').map(t => t.trim()).filter(Boolean);
            const newTags = bulkTags.split(',').map(t => t.trim()).filter(Boolean);
            const combinedTags = [...new Set([...existingTags, ...newTags])];
            finalUpdates.tags = combinedTags.join(',');
        }
        try {
            const response = await fetch('/api/update-video', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token.access_token}` },
                body: JSON.stringify({ videoId, updates: finalUpdates }),
            });
            if (!response.ok) console.error(`Failed to update video ${videoId}`);
        } catch (error) {
            console.error(`Error updating video ${videoId}:`, error);
        }
    }
    alert('Bulk update complete!');
    applyBulkEditBtn.textContent = 'Apply to Selected';
    await fetchVideosByFolder();
};

const renderTable = (videos) => {
    videoTbody.innerHTML = '';
    if (videos.length === 0) {
        videoTbody.innerHTML = '<tr><td colspan="8">No videos found in this folder.</td></tr>';
        return;
    }
    const privacyOptions = ['anybody', 'unlisted', 'password', 'nobody'];
    videos.forEach(video => {
        const row = document.createElement('tr');
        const videoId = video.uri.split('/').pop();
        row.dataset.videoId = videoId;
        const privacyDropdown = `<select class="privacy-select">${privacyOptions.map(opt => `<option value="${opt}" ${video.privacy.view === opt ? 'selected' : ''}>${opt.charAt(0).toUpperCase() + opt.slice(1)}</option>`).join('')}</select>`;
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
        row.querySelector('.save-btn').addEventListener('click', (e) => handleSave(e, currentUser));
        row.querySelector('.video-checkbox').addEventListener('change', handleSelectionChange);
    });
    selectedVideoIds.clear();
    updateBulkEditUI();
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
        setTimeout(() => { saveButton.textContent = 'Save'; }, 2000);
    } catch (error) {
        alert(`Error saving video: ${error.message}`);
        saveButton.textContent = 'Retry';
    } finally {
        saveButton.disabled = false;
    }
};

const fetchVideosByFolder = async () => {
    const selectedFolderUri = folderFilter.value;
    if (!selectedFolderUri) {
        tableContainer.style.display = 'block';
        videoTbody.innerHTML = '<tr><td colspan="8">Please select a folder.</td></tr>';
        return;
    }
    tableContainer.style.display = 'block';
    videoTbody.innerHTML = `<tr><td colspan="8">Fetching videos from folder...</td></tr>`;
    folderFilter.disabled = true;
    applyBulkEditBtn.disabled = true;
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
        applyBulkEditBtn.disabled = false;
    }
};

const fetchFolders = async (user) => {
    let allFolders = [];
    let nextPagePath = null;
    let pageCount = 0;
    folderFilter.innerHTML = `<option>Loading folders, page 1...</option>`;
    try {
        do {
            pageCount++;
            const fetchUrl = nextPagePath ? `/api/get-folders?page=${encodeURIComponent(nextPagePath)}` : '/api/get-folders';
            const response = await fetch(fetchUrl, { headers: { Authorization: `Bearer ${user.token.access_token}` } });
            if (!response.ok) throw new Error((await response.json()).error);
            const pageData = await response.json();
            allFolders = allFolders.concat(pageData.folders);
            nextPagePath = pageData.nextPagePath;
            if(nextPagePath) {
                folderFilter.innerHTML = `<option>Loading folders, page ${pageCount + 1}...</option>`;
            }
        } while (nextPagePath);
        folderFilter.innerHTML = '';
        if (allFolders.length === 0) {
            folderFilter.innerHTML = '<option value="">No folders found</option>';
            return;
        }
        allFolders.sort((a, b) => a.name.localeCompare(b.name));
        allFolders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder.uri;
            option.textContent = folder.name;
            folderFilter.appendChild(option);
        });
        folderFilter.disabled = false;
        await fetchVideosByFolder();
    } catch (error) {
        folderFilter.innerHTML = `<option>Error loading folders</option>`;
        console.error(error);
    }
};

// --- This is the new, stable entry point for the entire application ---
document.addEventListener('DOMContentLoaded', () => {
    // We wait for the entire page to be loaded before doing anything.

    // 1. Set up event listeners for elements we know now exist.
    folderFilter.addEventListener('change', fetchVideosByFolder);
    applyBulkEditBtn.addEventListener('click', handleBulkUpdate);
    selectAllCheckbox.addEventListener('click', () => {
        const allCheckboxes = document.querySelectorAll('.video-checkbox');
        allCheckboxes.forEach(checkbox => {
            checkbox.checked = selectAllCheckbox.checked;
            const videoId = checkbox.dataset.videoId;
            if (selectAllCheckbox.checked) {
                selectedVideoIds.add(videoId);
            } else {
                selectedVideoIds.delete(videoId);
            }
        });
        updateBulkEditUI();
    });

    // 2. Set up listeners for Netlify Identity events.
    netlifyIdentity.on('login', (user) => {
        currentUser = user;
        appContainer.style.display = 'block';
        fetchFolders(user);
    });

    netlifyIdentity.on('logout', () => {
        currentUser = null;
        appContainer.style.display = 'none';
        tableContainer.style.display = 'none';
        bulkEditBar.style.display = 'none';
        selectedVideoIds.clear();
    });
    
    // 3. Check for an already logged-in user.
    const user = netlifyIdentity.currentUser();
    if (user) {
        currentUser = user;
        appContainer.style.display = 'block';
        fetchFolders(user);
    }
});
