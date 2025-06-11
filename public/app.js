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
const tableHeader = document.querySelector('#video-table thead'); // NEW: Get the table header

let currentUser = null;
let originalVideoData = new Map();
let selectedVideoIds = new Set(); 
let currentVideos = []; // NEW: To hold the currently displayed video data
let sortState = { column: null, direction: 'asc' }; // NEW: To track sorting

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
            comparison = valA - valB;
        } else {
            valA = String(valA || '').toLowerCase();
            valB = String(valB || '').toLowerCase();
            comparison = valA.localeCompare(valB);
        }
        return sortState.direction === 'asc' ? comparison : -comparison;
    });

    renderTable(currentVideos);
};

const renderTable = (videos) => {
    videoTbody.innerHTML = '';
    
    const shouldClearOriginals = videos !== currentVideos;
    if (shouldClearOriginals) {
      originalVideoData.clear();
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
        if (shouldClearOriginals) {
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
    updateSortIcons();
};

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
        currentVideos = data;
        sortState = { column: null, direction: 'asc' };
        renderTable(currentVideos);
    } catch (error) {
        videoTbody.innerHTML = `<tr><td colspan="9" style="color: red;">Error: ${error.message}</td></tr>`;
    } finally {
        folderFilter.disabled = false;
    }
};

const handleSave = async (event, user) => { /* ... existing code ... */ };
const fetchFolders = async (user) => { /* ... existing code ... */ };
const updateBulkEditUI = () => { /* ... existing code ... */ };
const handleSelectionChange = (event) => { /* ... existing code ... */ };
const handleSaveAll = async () => { /* ... existing code ... */ };
const handleBulkUpdate = async () => { /* ... existing code ... */ };
const handleManageFolder = () => { /* ... existing code ... */ };

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
    selectAllCheckbox.addEventListener('click', () => { /* ... existing code ... */ });
    netlifyIdentity.on('login', (user) => { /* ... existing code ... */ });
    netlifyIdentity.on('logout', () => { /* ... existing code ... */ });
    const user = netlifyIdentity.currentUser();
    if (user) { /* ... existing code ... */ }
});
