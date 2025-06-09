document.addEventListener('DOMContentLoaded', () => {
    const videoList = document.getElementById('video-list');

    fetch('/api/vimeo')
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                 throw new Error(data.error);
            }
            const videosByFolder = {};

            data.data.forEach(video => {
                const folderName = video.parent_folder ? video.parent_folder.name : 'Uncategorized';
                if (!videosByFolder[folderName]) {
                    videosByFolder[folderName] = [];
                }
                videosByFolder[folderName].push(video);
            });

            for (const folderName in videosByFolder) {
                const folderContainer = document.createElement('div');
                folderContainer.className = 'folder';
                folderContainer.innerHTML = `<h2>${folderName}</h2>`;

                videosByFolder[folderName].forEach(video => {
                    const videoElement = document.createElement('div');
                    videoElement.className = 'video';
                    videoElement.innerHTML = `
                        <h3>${video.name}</h3>
                        <p><strong>Description:</strong> ${video.description || 'N/A'}</p>
                        <p><strong>Tags:</strong> ${video.tags.map(tag => tag.name).join(', ') || 'N/A'}</p>
                    `;
                    folderContainer.appendChild(videoElement);
                });
                videoList.appendChild(folderContainer);
            }
        })
        .catch(error => {
            console.error('Error fetching videos:', error);
            videoList.innerHTML = '<p>Failed to load videos. Check the console for more information.</p>';
        });
});
