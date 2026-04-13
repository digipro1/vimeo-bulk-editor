const appContainer = document.getElementById('app-container');
const videoTbody = document.getElementById('video-list');
const folderFilter = document.getElementById('folder-filter');
const bulkEditBar = document.getElementById('bulk-edit-bar');
const selectionCounter = document.getElementById('selection-counter');
const selectAllCheckbox = document.getElementById('select-all-checkbox');
const downloadCaptionsBtn = document.getElementById('download-captions-btn');
const descriptionModal = document.getElementById('description-modal');

let currentUser = null;
let originalVideoData = new Map();
let selectedVideoIds = new Set();
let currentlyEditingVideoId = null;

// The core "Keys" from your Data Governance strategy
const GOVERNANCE_KEYS = ['Minister', 'Scripture', 'Event Type', 'Topic', 'Location', 'Audience', 'Title', 'Date'];

// --- PARSING LOGIC ---
const parseVimeoDescription = (fullText) => {
    const parts = fullText.split('---');
    const summary = parts[0].trim();
    const metadata = {};
    
    if (parts[1]) {
        const lines = parts[1].split('\n');
        lines.forEach(line => {
            const [key, ...val] = line.split(':');
            if (key && val.length > 0) {
                const trimmedKey = key.trim();
                if (GOVERNANCE_KEYS.includes(trimmedKey)) {
                    metadata[trimmedKey] = val.join(':').trim();
                }
            }
        });
    }
    return { summary, metadata };
};

const assembleVimeoDescription = (summary, metadata) => {
    let newDesc = summary + '\n---\n';
    GOVERNANCE_KEYS.forEach(key => {
        if (metadata[key]) {
            newDesc += `${key}: ${metadata[key]}\n`;
        }
    });
    return newDesc.trim();
};

// --- RENDER TABLE ---
const renderTable = (videos) => {
    videoTbody.innerHTML = '';
    originalVideoData.clear();

    videos.forEach(video => {
        const videoId = video.uri.split('/').pop();
        const { summary, metadata } = parseVimeoDescription(video.description || '');
        
        originalVideoData.set(videoId, { summary, metadata, name: video.name });

        const row = document.createElement('tr');
        row.dataset.videoId = videoId;
        row.innerHTML = `
            <td><input type="checkbox" class="video-checkbox" data-video-id="${videoId}"></td>
            <td class="summary-cell" style="cursor:pointer; max-width:200px; overflow:hidden;">${summary || '(Edit Summary)'}</td>
            <td contenteditable="true" class="meta-Minister">${metadata['Minister'] || ''}</td>
            <td contenteditable="true" class="meta-Scripture">${metadata['Scripture'] || ''}</td>
            <td contenteditable="true" class="meta-EventType">${metadata['Event Type'] || ''}</td>
            <td contenteditable="true" class="meta-Topic">${metadata['Topic'] || ''}</td>
            <td contenteditable="true" class="meta-Location">${metadata['Location'] || ''}</td>
            <td contenteditable="true" class="meta-Audience">${metadata['Audience'] || ''}</td>
            <td><button class="save-btn">Save</button></td>
        `;
        videoTbody.appendChild(row);
    });
    document.getElementById('table-container').style.display = 'block';
};

// --- SAVE LOGIC ---
const handleSave = async (videoId, row) => {
    const summary = row.querySelector('.summary-cell').innerHTML;
    const metadata = {};
    GOVERNANCE_KEYS.forEach(key => {
        const cell = row.querySelector(`.meta-${key.replace(' ', '')}`);
        if (cell) metadata[key] = cell.innerText.trim();
    });

    const finalDescription = assembleVimeoDescription(summary, metadata);
    
    // Call your existing /api/update-video endpoint here with finalDescription
    console.log("Saving to Vimeo:", finalDescription);
};

// --- BULK UPDATE LOGIC ---
const handleBulkUpdate = () => {
    const bulkVals = {
        'Event Type': document.getElementById('bulk-event-type').value,
        'Minister': document.getElementById('bulk-minister').value.trim(),
        'Location': document.getElementById('bulk-location').value.trim(),
        'Audience': document.getElementById('bulk-audience').value
    };

    selectedVideoIds.forEach(id => {
        const row = document.querySelector(`tr[data-video-id="${id}"]`);
        Object.keys(bulkVals).forEach(key => {
            if (bulkVals[key]) {
                const cell = row.querySelector(`.meta-${key.replace(' ', '')}`);
                if (cell) cell.innerText = bulkVals[key];
            }
        });
    });
    alert('Local metadata updated. Don\'t forget to Save All Changes!');
};

// --- INITIALIZATION & EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('apply-bulk-edit-btn').addEventListener('click', handleBulkUpdate);
    
    videoTbody.addEventListener('click', (e) => {
        if (e.target.classList.contains('summary-cell')) {
            currentlyEditingVideoId = e.target.closest('tr').dataset.videoId;
            descriptionModal.style.display = 'flex';
            tinymce.get('tinymce-textarea').setContent(e.target.innerHTML);
        }
        if (e.target.classList.contains('save-btn')) {
            const row = e.target.closest('tr');
            handleSave(row.dataset.videoId, row);
        }
    });

    document.getElementById('modal-save-btn').addEventListener('click', () => {
        const content = tinymce.get('tinymce-textarea').getContent();
        const row = document.querySelector(`tr[data-video-id="${currentlyEditingVideoId}"]`);
        row.querySelector('.summary-cell').innerHTML = content;
        descriptionModal.style.display = 'none';
    });

    // ... (rest of your existing Netlify login and folder fetching logic)
});
