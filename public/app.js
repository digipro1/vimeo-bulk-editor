const appContainer = document.getElementById('app-container');
const folderFilter = document.getElementById('folder-filter');
const tableContainer = document.getElementById('table-container');
const videoTbody = document.getElementById('video-list');
const saveAllBtn = document.getElementById('save-all-btn');
const manageFolderBtn = document.getElementById('manage-folder-btn');
// NEW: Modal elements
const descriptionModal = document.getElementById('description-modal');
const tinymceTextarea = document.getElementById('tinymce-textarea');
const modalSaveBtn = document.getElementById('modal-save-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalCloseBtn = document.getElementById('modal-close-btn');

let currentUser = null;
let originalVideoData = new Map();
let currentlyEditingVideoId = null; // NEW: To track which video is open in the modal

// --- NEW: MODAL AND EDITOR FUNCTIONS ---
const openDescriptionEditor = (videoId) => {
    currentlyEditingVideoId = videoId;
    const row = videoTbody.querySelector(`tr[data-video-id="${videoId}"]`);
    if (!row) return;

    const descriptionCell = row.querySelector('.description-cell');
    const currentDescriptionHtml = descriptionCell.innerHTML;
    
    // Show the modal
    descriptionModal.style.display = 'flex';
    
    // Initialize TinyMCE
    tinymce.init({
        selector: '#tinymce-textarea',
        height: 300,
        menubar: false,
        plugins: 'lists link',
        toolbar: 'undo redo | blocks | bold italic underline | bullist numlist | link',
        setup: function (editor) {
            // Set the initial content once the editor is ready
            editor.on('init', function () {
                editor.setContent(currentDescriptionHtml);
            });
        }
    });
};

const closeDescriptionEditor = () => {
    // IMPORTANT: Remove the editor instance to prevent memory leaks
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
// Description cell is no longer contenteditable but is now clickable
const renderTable = (videos) => {
    videoTbody.innerHTML = '';
    originalVideoData.clear();
    saveAllBtn.style.display = 'none';
    manageFolderBtn.style.display = 'none';

    if (videos.length === 0) {
        videoTbody.innerHTML = '<tr><td colspan="7">No videos found in this folder.</td></tr>';
        return;
    }
    const privacyOptions = ['anybody', 'unlisted', 'password', 'nobody'];
    videos.forEach(video => {
        const videoId = video.uri.split('/').pop();
        // UPDATED: Store original description as HTML
        originalVideoData.set(videoId, {
            name: video.name || '',
            description: video.description || '', // This is raw HTML from Vimeo
            tags: video.tags.map(tag => tag.name).join(', '),
            privacy: video.privacy.view,
        });
        const row = document.createElement('tr');
        row.dataset.videoId = videoId;
        const privacyDropdown = `<select class="privacy-select">${privacyOptions.map(opt => `<option value="${opt}" ${video.privacy.view === opt ? 'selected' : ''}>${opt.charAt(0).toUpperCase() + opt.slice(1)}</option>`).join('')}</select>`;
        
        row.innerHTML = `
            <td class="video-title" contenteditable="true">${video.name || ''}</td>
            <td class="description-cell">${video.description || '(No description)'}</td>
            <td class="video-tags" contenteditable="true">${video.tags.map(tag => tag.name).join(', ')}</td>
            <td>${privacyDropdown}</td>
            <td>${video.status}</td>
            <td><a href="https://vimeo.com/manage/videos/${videoId}" target="_blank" class="manage-link">Manage</a></td>
            <td><button class="save-btn">Save</button></td>
        `;
        videoTbody.appendChild(row);
        row.querySelector('.save-btn').addEventListener('click', (e) => handleSave(e, currentUser));
    });

    saveAllBtn.style.display = 'inline-block';
    manageFolderBtn.style.display = 'inline-block';
};

// --- INDIVIDUAL & ALL SAVE FUNCTIONS (UPDATED) ---
// The save functions must now get the description from innerHTML, not textContent
const getUpdatesFromRow = (row) => {
    const videoId = row.dataset.videoId;
    return {
        videoId: videoId,
        updates: {
            name: row.querySelector('.video-title').textContent,
            description: row.querySelector('.description-cell').innerHTML, // Use innerHTML to keep rich text
            tags: row.querySelector('.video-tags').textContent,
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
        originalVideoData.set(videoId, { ...updates, privacy: updates.privacy.view });
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
        const { updates: current } = getUpdatesFromRow(row);

        if (original.name !== current.name || original.description !== current.description || original.tags !== current.tags || original.privacy !== current.privacy.view) {
            changedRowsData.push({ videoId, updates: current });
        }
    });

    if (changedRowsData.length === 0) {
        alert('No changes to save.');
        return;
    }
    // ... (rest of the handleSaveAll function remains the same)
    saveAllBtn.textContent = 'Saving...';
    saveAllBtn.disabled = true;
    folderFilter.disabled = true;
    manageFolderBtn.disabled = true;
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
    saveAllBtn.disabled = false;
    folderFilter.disabled = false;
    manageFolderBtn.disabled = false;
    await fetchVideosByFolder();
};

// --- All other functions (fetchFolders, fetchVideosByFolder) are unchanged ---

const fetchVideosByFolder = async () => { /* ... existing fetchVideosByFolder code ... */ };
const fetchFolders = async (user) => { /* ... existing fetchFolders code ... */ };
const handleManageFolder = () => { /* ... existing handleManageFolder code ... */ };

// --- This block runs when the page is ready ---
document.addEventListener('DOMContentLoaded', () => {
    // Add listeners for page controls
    folderFilter.addEventListener('change', fetchVideosByFolder);
    saveAllBtn.addEventListener('click', handleSaveAll);
    manageFolderBtn.addEventListener('click', handleManageFolder);

    // NEW: Add listeners for the modal
    modalSaveBtn.addEventListener('click', saveDescriptionFromModal);
    modalCancelBtn.addEventListener('click', closeDescriptionEditor);
    modalCloseBtn.addEventListener('click', closeDescriptionEditor);
    descriptionModal.addEventListener('click', (event) => {
        // Close modal if user clicks on the dark overlay
        if (event.target === descriptionModal) {
            closeDescriptionEditor();
        }
    });

    // NEW: Use event delegation to open the editor when a description cell is clicked
    videoTbody.addEventListener('click', (event) => {
        const descriptionCell = event.target.closest('.description-cell');
        if (descriptionCell) {
            const videoId = descriptionCell.closest('tr').dataset.videoId;
            openDescriptionEditor(videoId);
        }
    });

    // Netlify Identity auth flow
    netlifyIdentity.on('login', (user) => { /* ... existing auth code ... */ });
    netlifyIdentity.on('logout', () => { /* ... existing auth code ... */ });
    const user = netlifyIdentity.currentUser();
    if (user) { /* ... existing auth code ... */ }
});

// PASTE IN THE UNCHANGED FUNCTIONS HERE
