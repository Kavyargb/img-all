document.addEventListener('DOMContentLoaded', () => {

    // --- DATA ---
    // List of image links. In a real app, this might come from an API.
    // Using picsum.photos for dynamic, unique placeholder images.
    const initialImageLinks = [
        'https://picsum.photos/id/10/800/600',
        'https://picsum.photos/id/20/800/600',
        'https://picsum.photos/id/30/800/600',
        'https://picsum.photos/id/40/800/600',
        'https://picsum.photos/id/50/800/600',
        'https://picsum.photos/id/60/800/600',
        'https://picsum.photos/id/70/800/600',
        'https://picsum.photos/id/80/800/600',
        'https://picsum.photos/id/90/800/600',
        'https://picsum.photos/id/100/800/600',
        'https://picsum.photos/id/110/800/600',
        'https://picsum.photos/id/120/800/600',
    ];

    // --- DOM ELEMENTS ---
    const imageGrid = document.getElementById('imageGrid');
    const themeToggle = document.getElementById('themeToggle');
    const sortButtons = {
        default: document.getElementById('sortDefault'),
        mostViewed: document.getElementById('sortMostViewed'),
        mostLiked: document.getElementById('sortMostLiked'),
    };

    // --- "AI" MODEL & STATE MANAGEMENT ---
    let imageData = [];
    const viewedInSession = new Set(); // To prevent counting views multiple times per session

    // Function to load data from localStorage or initialize it
    function loadData() {
        const storedData = localStorage.getItem('kavyaImageData');
        if (storedData) {
            imageData = JSON.parse(storedData);
        } else {
            // First time visit: create the initial data structure
            imageData = initialImageLinks.map((url, index) => ({
                id: `img-${index}`,
                url: url,
                views: 0,
                likes: 0,
                liked: false
            }));
            saveData();
        }
    }

    // Function to save the current state to localStorage
    function saveData() {
        localStorage.setItem('kavyaImageData', JSON.stringify(imageData));
    }

    // --- RENDERING ---
    function renderGrid(imagesToRender = imageData) {
        imageGrid.innerHTML = ''; // Clear the grid
        imagesToRender.forEach(image => {
            const card = document.createElement('div');
            card.className = 'image-card';
            card.dataset.id = image.id; // Set data-id for easy lookup

            card.innerHTML = `
                <img src="${image.url}" alt="Gallery image" loading="lazy">
                <div class="info-overlay">
                    <div class="stats">
                        <span class="views-count"><i class="fas fa-eye"></i> ${image.views}</span>
                    </div>
                    <div class="like-container">
                        <span class="likes-count">${image.likes}</span>
                        <i class="like-btn fas fa-heart ${image.liked ? 'liked' : ''}" data-id="${image.id}"></i>
                    </div>
                </div>
            `;
            imageGrid.appendChild(card);
        });
        setupIntersectionObserver();
    }
    
    // --- EVENT HANDLERS & INTERACTIONS ---

    // Handle Clicks on the Grid (using event delegation)
    imageGrid.addEventListener('click', (e) => {
        if (e.target.classList.contains('like-btn')) {
            const imageId = e.target.dataset.id;
            handleLike(imageId);
        }
    });

    // Handle "Liking" an image
    function handleLike(id) {
        const image = imageData.find(img => img.id === id);
        if (!image) return;

        if (image.liked) {
            image.likes--;
            image.liked = false;
        } else {
            image.likes++;
            image.liked = true;
        }

        saveData();
        updateCardUI(id); // Update just the specific card
    }

    // Update a single card's UI after an interaction
    function updateCardUI(id) {
        const image = imageData.find(img => img.id === id);
        const card = imageGrid.querySelector(`.image-card[data-id="${id}"]`);
        if (!card) return;

        const likeBtn = card.querySelector('.like-btn');
        const likesCount = card.querySelector('.likes-count');
        const viewsCount = card.querySelector('.views-count');

        likesCount.textContent = image.likes;
        viewsCount.innerHTML = `<i class="fas fa-eye"></i> ${image.views}`;
        likeBtn.classList.toggle('liked', image.liked);
    }
    
    // AI Part 1: Track Views with Intersection Observer
    function setupIntersectionObserver() {
        const options = {
            root: null, // viewport
            rootMargin: '0px',
            threshold: 0.5 // Trigger when 50% of the item is visible
        };

        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const imageId = entry.target.dataset.id;
                    if (!viewedInSession.has(imageId)) {
                        const image = imageData.find(img => img.id === imageId);
                        if (image) {
                            image.views++;
                            viewedInSession.add(imageId); // Mark as viewed in this session
                            saveData();
                            updateCardUI(imageId);
                        }
                    }
                    // Optional: unobserve after viewing to save resources
                    // observer.unobserve(entry.target);
                }
            });
        }, options);

        document.querySelectorAll('.image-card').forEach(card => {
            observer.observe(card);
        });
    }

    // AI Part 2: Sorting/Categorization Logic
    function setActiveButton(activeBtn) {
        Object.values(sortButtons).forEach(btn => btn.classList.remove('active'));
        activeBtn.classList.add('active');
    }

    sortButtons.default.addEventListener('click', () => {
        setActiveButton(sortButtons.default);
        const sortedById = [...imageData].sort((a, b) => parseInt(a.id.split('-')[1]) - parseInt(b.id.split('-')[1]));
        renderGrid(sortedById);
    });

    sortButtons.mostViewed.addEventListener('click', () => {
        setActiveButton(sortButtons.mostViewed);
        const sortedByViews = [...imageData].sort((a, b) => b.views - a.views);
        renderGrid(sortedByViews);
    });

    sortButtons.mostLiked.addEventListener('click', () => {
        setActiveButton(sortButtons.mostLiked);
        const sortedByLikes = [...imageData].sort((a, b) => b.likes - a.likes);
        renderGrid(sortedByLikes);
    });

    // Theme Switcher Logic
    themeToggle.addEventListener('change', () => {
        document.body.classList.toggle('light-theme');
        localStorage.setItem('theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
    });

    function loadTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            themeToggle.checked = false; // Light mode: moon visible, so toggle is off
        } else {
            document.body.classList.remove('light-theme');
            themeToggle.checked = true; // Dark mode: sun visible, so toggle is on
        }
    }


    // --- INITIALIZATION ---
    function init() {
        loadData();
        loadTheme();
        renderGrid();
    }

    init();
});
