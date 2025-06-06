// --- NETLIFY IDENTITY AUTHENTICATION GATE ---
window.netlifyIdentity.on('init', user => {
    if (!user) {
        window.netlifyIdentity.on('login', () => { document.location.href = "/"; });
    } else {
        console.log('Authenticated user found:', user.email);
        document.getElementById('app-container').style.display = 'block';
        runApplication();
    }
});
window.netlifyIdentity.on('logout', () => { document.location.href = "/"; });


async function runApplication() {
    const loader = document.getElementById('loader');
    const foldersContainer = document.getElementById('folders-container');
    try {
        loader.style.display = 'block';
        const [folders, videos] = await Promise.all([fetchFolders(), fetchAllVideos()]);
        const organizedData = organizeDataByFolder(folders, videos);
        renderData(organizedData);
    } catch (error) {
        foldersContainer.innerHTML = `<div class="error">Failed to load video data: ${error.message}</div>`;
        console.error("Application failed:", error);
    } finally {
        loader.style.display = 'none';
    }
}

// --- CONFIGURATION ---
const PROXY_URL = 'https://vimeo-data-editor.netlify.app';
const VIMEO_USER_ID = '183962336'; // Your specific Vimeo User ID

// --- DATA FETCHING FUNCTIONS ---
async function fetchFolders() {
    // Using the specific user endpoint instead of /me
    const response = await fetch(`${PROXY_URL}/users/${VIMEO_USER_ID}/projects?per_page=100`);
    if (!response.ok) throw new Error('Could not fetch folders.');
    const data = await response.json();
    return data.data;
}

async function fetchAllVideos() {
    let videos = [];
    // Using the specific user endpoint instead of /me
    let nextPageUrl = `${PROXY_URL}/users/${VIMEO_USER_ID}/videos?fields=uri,name,description,tags,parent_folder,pictures&per_page=100`;
    while (nextPageUrl) {
        const response = await fetch(nextPageUrl);
        if (!response.ok) {
            // Throw a more specific error based on the response status
            throw new Error(`Could not fetch videos. Status: ${response.status} ${response.statusText}`);
        }
        const pageData = await response.json();
        videos = videos.concat(pageData.data);
        
        // The paging.next from Vimeo is a full path, so we need to rebuild the proxy URL
        if (pageData.paging.next) {
            nextPageUrl = `${PROXY_URL}${pageData.paging.next}`;
        } else {
            nextPageUrl = null;
        }
    }
    return videos;
}

// --- DATA PROCESSING ---
function organizeDataByFolder(folders, videos) {
    const organized = {
        ...folders.reduce((acc, folder) => {
            acc[folder.uri] = { name: folder.name, videos: [] };
            return acc;
        }, {}),
        unassigned: { name: "Videos Not in a Folder", videos: [] }
    };
    videos.forEach(video => {
        const parentFolder = video.parent_folder;
        if (parentFolder && organized[parentFolder.uri]) {
            organized[parentFolder.uri].videos.push(video);
        } else {
            organized.unassigned.videos.push(video);
        }
    });
    return organized;
}

// --- UI RENDERING ---
function renderData(data) {
    const foldersContainer = document.getElementById('folders-container');
    foldersContainer.innerHTML = '';
    for (const folderUri in data) {
        const folderData = data[folderUri];
        if (folderData.videos.length === 0 && folderUri !== 'unassigned') continue;
        const folderElement = document.createElement('div');
        folderElement.className = 'folder';
        folderElement.innerHTML = `
            <div class="folder-header">${folderData.name}</div>
            <div class="videos-container">
                ${folderData.videos.map(video => createVideoCardHTML(video)).join('')}
            </div>
        `;
        foldersContainer.appendChild(folderElement);
    }
    document.querySelectorAll('.save-button').forEach(button => {
        button.addEventListener('click', handleSaveClick);
    });
}

function createVideoCardHTML(video) {
    const videoId = video.uri.split('/').pop();
    const tags = video.tags.map(tag => tag.name).join(', ');
    return `
        <div class="video-card" id="video-${videoId}">
            <div class="video-thumbnail">
                <img src="${video.pictures.base_link}" alt="Thumbnail for ${video.name}">
            </div>
            <div class="video-details">
                <label for="title-${videoId}">Title</label>
                <input type="text" id="title-${videoId}" value="${video.name || ''}">
                <label for="desc-${videoId}">Description</label>
                <textarea id="desc-${videoId}">${video.description || ''}</textarea>
                <label for="tags-${videoId}">Tags (comma-separated)</label>
                <input type="text" id="tags-${videoId}" value="${tags}">
                <button class="save-button" data-video-id="${videoId}">Save</button>
            </div>
        </div>
    `;
}

// --- EVENT HANDLING & API UPDATES ---
async function handleSaveClick(event) {
    const button = event.target;
    const videoId = button.dataset.videoId;
    if (button.classList.contains('saving')) return;
    button.classList.add('saving');
    button.textContent = 'Saving...';
    try {
        const payload = {
            name: document.getElementById(`title-${videoId}`).value,
            description: document.getElementById(`desc-${videoId}`).value,
            tags: document.getElementById(`tags-${videoId}`).value
        };
        const response = await fetch(`${PROXY_URL}/videos/${videoId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.developer_message || 'Failed to save.');
        }
        button.style.backgroundColor = '#28a745';
        button.textContent = 'Saved!';
    } catch (error) {
        console.error(`Failed to update video ${videoId}:`, error);
        button.style.backgroundColor = '#dc3545';
        button.textContent = `Error!`;
    } finally {
        setTimeout(() => {
            button.classList.remove('saving');
            button.style.backgroundColor = '';
            button.textContent = 'Save';
        }, 3000);
    }
}
