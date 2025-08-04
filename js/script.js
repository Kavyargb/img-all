document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION ---
    const BATCH_SIZE = 12;

    // --- DATA ---
    // 'allImageData' is now a global variable provided by the inline script in index.html.
    // It contains the full data set: [{id: 1, url: '...', views: 10, likes: 5}, ...]
    let displayedImageData = []; // This will hold the images currently on the page
    let currentIndex = 0;
    const viewedInSession = new Set();
    let infiniteScrollObserver;

    // --- DOM ELEMENTS ---
    const imageGrid = document.getElementById('imageGrid');
    const loadTrigger = document.getElementById('load-trigger');
    const themeToggle = document.getElementById('themeToggle');
    const sortButtons = {
        default: document.getElementById('sortDefault'),
        mostViewed: document.getElementById('sortMostViewed'),
        mostLiked: document.getElementById('sortMostLiked'),
    };
    
    // "AI" MODEL & DATA HANDLING - This is now done on the backend initially.
    // We only need client-side sorting for the "Most Viewed/Liked" buttons.

    // --- RENDERING LOGIC ---
    function createImageCard(image) {
        const card = document.createElement('div');
        card.className = 'image-card';
        card.dataset.id = image.id; // Use the database ID
        card.innerHTML = `
            <img src="${image.url}" alt="Gallery image" loading="lazy">
            <div class="info-overlay">
                <div class="stats">
                    <span class="views-count"><i class="fas fa-eye"></i> ${image.views}</span>
                </div>
                <div class="like-container">
                    <span class="likes-count">${image.likes}</span>
                    <i class="like-btn fas fa-heart" data-id="${image.id}"></i>
                </div>
            </div>
        `;
        return card;
    }

    function appendImagesToGrid(imageBatch) {
        const fragment = document.createDocumentFragment();
        imageBatch.forEach(image => {
            const card = createImageCard(image);
            fragment.appendChild(card);
            setupViewObserverForCard(card);
        });
        imageGrid.appendChild(fragment);
    }
    
    function renderFullGrid(imagesToRender) {
        imageGrid.innerHTML = '';
        appendImagesToGrid(imagesToRender);
    }

    // --- LAZY LOADING / INFINITE SCROLL ---
    function loadNextBatch() {
        const batch = allImageData.slice(currentIndex, currentIndex + BATCH_SIZE);
        if (batch.length > 0) {
            appendImagesToGrid(batch);
            displayedImageData.push(...batch);
            currentIndex += BATCH_SIZE;
        }
        if (currentIndex >= allImageData.length) {
            if (infiniteScrollObserver) infiniteScrollObserver.disconnect();
        }
    }

    function setupInfiniteScroll() {
        const options = { rootMargin: '400px' };
        infiniteScrollObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) loadNextBatch();
        }, options);
        if(loadTrigger) {
            infiniteScrollObserver.observe(loadTrigger);
        }
    }
    
    function resetAndEnableInfiniteScroll(dataSource = allImageData) {
        if (infiniteScrollObserver) infiniteScrollObserver.disconnect();
        imageGrid.innerHTML = '';
        currentIndex = 0;
        displayedImageData = [];
        const batch = dataSource.slice(currentIndex, currentIndex + BATCH_SIZE);
        if(batch.length > 0) {
            appendImagesToGrid(batch);
            displayedImageData.push(...batch);
            currentIndex += BATCH_SIZE;
        }
        setupInfiniteScroll();
    }
    
    // --- SERVER COMMUNICATION & UI UPDATES ---
    
    function handleLike(id) {
        const image = allImageData.find(img => img.id == id);
        if (!image) return;

        // Visual feedback first
        const card = imageGrid.querySelector(`.image-card[data-id="${id}"]`);
        if (card) {
            const likeBtn = card.querySelector('.like-btn');
            likeBtn.classList.add('pop', 'liked'); // Assume success, make it red instantly
        }

        // Call the server API
        fetch(`/api/like/${id}`, { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Update local data and UI with confirmed count from server
                    image.likes = data.new_likes;
                    updateCardUI(id);
                }
            })
            .catch(error => console.error('Error liking image:', error));
    }

    function handleView(id) {
        if (viewedInSession.has(id)) return; // Don't report view twice in one session
        
        const image = allImageData.find(img => img.id == id);
        if (!image) return;

        viewedInSession.add(id); // Mark as viewed for this session

        // Call the server API
        fetch(`/api/view/${id}`, { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Update local data and UI with confirmed count from server
                    image.views = data.new_views;
                    updateCardUI(id);
                }
            })
            .catch(error => console.error('Error viewing image:', error));
    }

    function updateCardUI(id) {
        const image = allImageData.find(img => img.id == id);
        if (!image) return;
        
        const card = imageGrid.querySelector(`.image-card[data-id="${id}"]`);
        if (!card) return;

        card.querySelector('.likes-count').textContent = image.likes;
        card.querySelector('.views-count').innerHTML = `<i class="fas fa-eye"></i> ${image.views}`;
        // The 'liked' class is now handled optimistically in handleLike
    }
    
    const viewObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const imageId = entry.target.dataset.id;
                handleView(imageId);
            }
        });
    }, { threshold: 0.5 });
    
    function setupViewObserverForCard(card) {
        viewObserver.observe(card);
    }

    // --- EVENT HANDLERS ---
    imageGrid.addEventListener('click', (e) => {
        if (e.target.classList.contains('like-btn')) {
            handleLike(e.target.dataset.id);
        }
    });

    function setActiveButton(activeBtn) {
        Object.values(sortButtons).forEach(btn => btn.classList.remove('active'));
        activeBtn.classList.add('active');
    }

    sortButtons.default.addEventListener('click', () => {
        // "Default" sort is the initial server-provided AI sort.
        // We just re-render from the original allImageData array.
        setActiveButton(sortButtons.default);
        if (infiniteScrollObserver) infiniteScrollObserver.disconnect();
        resetAndEnableInfiniteScroll(allImageData);
    });

    sortButtons.mostViewed.addEventListener('click', () => {
        setActiveButton(sortButtons.mostViewed);
        if (infiniteScrollObserver) infiniteScrollObserver.disconnect();
        const sortedByViews = [...allImageData].sort((a, b) => b.views - a.views);
        renderFullGrid(sortedByViews);
    });

    sortButtons.mostLiked.addEventListener('click', () => {
        setActiveButton(sortButtons.mostLiked);
        if (infiniteScrollObserver) infiniteScrollObserver.disconnect();
        const sortedByLikes = [...allImageData].sort((a, b) => b.likes - a.likes);
        renderFullGrid(sortedByLikes);
    });

    themeToggle.addEventListener('change', () => {
        document.body.classList.toggle('light-theme');
        localStorage.setItem('theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
    });

    function loadTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            themeToggle.checked = false; 
        } else {
            document.body.classList.remove('light-theme');
            themeToggle.checked = true;
        }
    }

    // --- INITIALIZATION ---
    function init() {
        loadTheme();
        // The initial data is already sorted by the backend's "AI" model.
        // We can just start the infinite scroll.
        resetAndEnableInfiniteScroll(allImageData);
    }

    init();
});