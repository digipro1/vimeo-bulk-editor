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
const downloadCaptionsBtn = document.getElementById('download-captions-btn');
const tableHeader = document.querySelector('#video-table thead');
// NEW: Modal elements
const descriptionModal = document.getElementById('description-modal');
const modalSaveBtn = document.getElementById('modal-save-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalCloseBtn = document.getElementById('modal-close-btn');

let currentUser = null;
let originalVideoData = new Map();
let selectedVideoIds = new Set(); 
let currentVideos = [];
let sortState = { column: null, direction: 'asc' };
let currentlyEditingVideoId = null;

// --- NEW: MODAL AND EDITOR FUNCTIONS ---
const openDescriptionEditor = (videoId) => {
    currentlyEditingVideoId = videoId;
    const row = videoTbody.querySelector(`tr[data-video-id="${videoId}"]`);
    if (!row) return;

    const currentDescriptionHtml = originalVideoData.get(videoId)?.description || '';
    
    descriptionModal.style.display = 'flex';
    
    tinymce.init({
        selector: '#tinymce-textarea',
        height: 350,
        menubar: false,
        plugins: 'lists link',
        toolbar: 'undo redo | blocks | bold italic underline | bullist numlist | link',
        setup: (editor) => {
            editor.on('init', () => editor.setContent(currentDescriptionHtml));
        }
    });
};

const closeDescriptionEditor = () => {
    if (tinymce.get('tinymce-textarea')) {
        tinymce.get('tinymce-textarea').remove();
    }
    descriptionModal.style.display = 'none';
    currentlyEditingVideoId = null;
};

const saveDescriptionFromModal = () => {
    if (!currentlyEditingVideoId) return;

    const editorContent = tinymce.get('tinymce-textarea').getContent();
    const row = videoTbody.querySelector(`tr[data-video-id="${currentlyEditingVideoId}"]`);
    if (row) {
        const descriptionCell = row.querySelector('.description-cell');
        descriptionCell.innerHTML = editorContent;
    }
    closeDescriptionEditor();
};

// --- RENDER TABLE (UPDATED) ---
const renderTable = (videos) => {
    videoTbody.innerHTML = '';
    const isNewData = videos !== currentVideos;
    if (isNewData) {
      originalVideoData.clear();
      currentVideos = videos;
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
                name: video.name || '',
                description: video.description || '', // Store raw HTML
                tags: video.tags.map(tag => tag.name).join(', '), 
                privacy: video.privacy.view,
            });
        }
        const row = document.createElement('tr');
        row.dataset.videoId = videoId;
        const privacyDropdown = `<select class="privacy-select">${privacyOptions.map(opt => `<option value="${opt}" ${video.privacy.view === opt ? 'selected' : ''}>${opt.charAt(0).toUpperCase() + opt.slice(1)}</option>`).join('')}</select>`;
        
        row.innerHTML = `
            <td><input type="checkbox" class="video-checkbox" data-video-id="${videoId}"></td>
            <td class="video-title" contenteditable="true">${video.name || ''}</td>
            <td class="description-cell">${video.description || '(No description)'}</td>
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

// --- SAVE FUNCTIONS (UPDATED) ---
// Now reads description from innerHTML to preserve formatting
const getUpdatesFromRow = (row) => {
    const videoId = row.dataset.videoId;
    return {
        videoId: videoId,
        updates: {
            name: row.querySelector('.video-title').textContent,
            description: row.querySelector('.description-cell').innerHTML, // Use innerHTML
            tags: parseTagsForAPI(row.querySelector('.video-tags').textContent),
            privacy: { view: row.querySelector('.privacy-select').value }
        }
    };
};

const handleSave = async (event, user) => {
    const saveButton = event.target;
    const row = saveButton.closest('tr');
    const { videoId, updates } = getUpdatesFromRow(row);
    
    saveButton.textContent = 'Saving...';
    saveButton.disabled = true;
    try {
        const response = await fetch('/api/update-video', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token.access_token}` },
            body: JSON.stringify({ videoId, updates }),
        });
        if (!response.ok) throw new Error((await response.json()).error);
        saveButton.textContent = 'Saved!';
        originalVideoData.set(videoId, { ...updates, tags: updates.tags.map(t=>t.name).join(', '), privacy: updates.privacy.view });
        setTimeout(() => { saveButton.textContent = 'Save'; }, 2000);
    } catch (error) {
        alert(`Error saving video: ${error.message}`);
        saveButton.textContent = 'Retry';
    } finally {
        saveButton.disabled = false;
    }
};

const handleSaveAll = async () => {
    const changedRowsData = [];
    const allRows = videoTbody.querySelectorAll('tr');
    allRows.forEach(row => {
        const videoId = row.dataset.videoId;
        if (!videoId) return;

        const original = originalVideoData.get(videoId);
        const { updates: currentUpdates } = getUpdatesFromRow(row);
        const current = {
            ...currentUpdates,
            tags: currentUpdates.tags.map(t=>t.name).join(', '),
            privacy: currentUpdates.privacy.view,
        };
        
        if (original.name !== current.name || original.description !== current.description || original.tags !== current.tags || original.privacy !== current.privacy) {
            changedRowsData.push({ videoId, updates: currentUpdates });
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

// --- All other functions are unchanged, just pasted for completeness ---
const fetchVideosByFolder = async () => { /* ... see previous steps ... */ };
const parseTagsForAPI = (tagString) => { /* ... see previous steps ... */ };
const fetchFolders = async (user) => { /* ... see previous steps ... */ };
const updateBulkEditUI = () => { /* ... see previous steps ... */ };
const handleSelectionChange = (event) => { /* ... see previous steps ... */ };
const handleBulkUpdate = async () => { /* ... see previous steps ... */ };
const handleManageFolder = () => { /* ... see previous steps ... */ };
const updateSortIcons = () => { /* ... see previous steps ... */ };
const sortVideos = (key) => { /* ... see previous steps ... */ };
const formatDuration = (seconds) => { /* ... see previous steps ... */ };

// --- PAGE AND AUTHENTICATION SETUP ---
document.addEventListener('DOMContentLoaded', () => {
    // Event listeners for page controls
    tableHeader.addEventListener('click', (event) => {
        const header = event.target.closest('.sortable-header');
        if (header) { sortVideos(header.dataset.sortKey); }
    });
    downloadCaptionsBtn.addEventListener('click', handleDownloadCaptions);
    folderFilter.addEventListener('change', fetchVideosByFolder);
    saveAllBtn.addEventListener('click', handleSaveAll);
    manageFolderBtn.addEventListener('click', handleManageFolder);
    applyBulkEditBtn.addEventListener('click', handleBulkUpdate);
    selectAllCheckbox.addEventListener('click', () => { /* ... see previous steps ... */ });

    // NEW: Event listeners for the modal
    modalSaveBtn.addEventListener('click', saveDescriptionFromModal);
    modalCancelBtn.addEventListener('click', closeDescriptionEditor);
    modalCloseBtn.addEventListener('click', closeDescriptionEditor);
    descriptionModal.addEventListener('click', (event) => {
        if (event.target === descriptionModal) { closeDescriptionEditor(); }
    });
    videoTbody.addEventListener('click', (event) => {
        const descriptionCell = event.target.closest('.description-cell');
        if (descriptionCell) {
            const videoId = descriptionCell.closest('tr').dataset.videoId;
            openDescriptionEditor(videoId);
        }
    });

    // Netlify Identity auth flow
    netlifyIdentity.on('login', (user) => { /* ... see previous steps ... */ });
    netlifyIdentity.on('logout', () => { /* ... see previous steps ... */ });
    const user = netlifyIdentity.currentUser();
    if (user) { /* ... see previous steps ... */ }
});
