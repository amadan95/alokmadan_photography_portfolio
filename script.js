// Photography Portfolio JavaScript
// Authentic Film Contact Sheet with EXIF Data

class PhotographyPortfolio {
    constructor() {
        this.photos = [];
        this.totalPhotos = 0; // Will be set by API call
        this.scrollY = 0;
        this.lastTriggeredMarkType = null; // For ensuring mark variety with IntersectionObserver
        this.scrollAnimationQueue = []; // Queue for scroll-triggered animations
        this.isScrollAnimationPlaying = false; // Flag to manage sequential scroll animations
        this.currentlyLoadingExif = new Set();
        this.exifCache = new Map();
        this.init();
    }

    init() {
        this.initializePhotos();
        this.setupEventListeners();
        this.applyFilmStockStyle('cinestill'); // Changed default to 'cinestill'
        // Also update the dropdown to reflect this default
        const filmStockSelector = document.getElementById('film-stock-selector');
        if (filmStockSelector) {
            filmStockSelector.value = 'cinestill';
        }
    }

    async initializePhotos() {
        console.log("[PhotoGrid] Initializing photos...");
        const photoGrid = document.querySelector('.photo-grid');
        if (!photoGrid) {
            console.error("[PhotoGrid] Critical: '.photo-grid' element not found in the DOM. Cannot render photos.");
            document.body.innerHTML = '<p style="color: red; text-align: center; font-size: 20px;">Error: Photo grid container not found. Site cannot load.</p>';
            return;
        }
        photoGrid.innerHTML = ''; // Clear previous grid
        this.photos = [];

        try {
            const response = await fetch('/api/get-cloudinary-images');
            if (!response.ok) {
                const errorText = await response.text(); // Get raw text for more detailed error
                console.error(`[PhotoGrid] Failed to fetch images: ${response.status} ${response.statusText}. Server response: ${errorText}`);
                photoGrid.innerHTML = `<p style="color: red; text-align: center;">Error loading photo data from server (status ${response.status}). Details: ${response.statusText}. Check console and Vercel logs.</p>`;
                return;
            }
            const data = await response.json();
            const cloudinaryPhotos = data.images;

            if (!cloudinaryPhotos || cloudinaryPhotos.length === 0) {
                console.warn("[PhotoGrid] No photos returned from Cloudinary API or API error.");
                this.totalPhotos = 0;
                // Optionally, display a message to the user in the UI
                this.container.innerHTML = '<p style="color: white; text-align: center;">No photos available. Please check the Cloudinary configuration.</p>';
                return;
            }

            this.totalPhotos = cloudinaryPhotos.length;
            console.log(`[PhotoGrid] ${this.totalPhotos} photos found in Cloudinary.`);

            this.photos = cloudinaryPhotos.map((photoData, index) => ({
                id: index + 1, // Keep sequential ID for now, or use photoData.id if it's suitable & unique for your needs
                src: photoData.src,
                alt: `Photo ${index + 1}`,
                exifLoaded: !!photoData.exif, // EXIF is pre-loaded
                exif: photoData.exif || { iso: 'N/A', shutter: 'N/A', fStop: 'N/A', model: 'N/A', lens: 'N/A' }, // Ensure exif object exists
                rawExif: photoData.exifRaw, // Store raw EXIF if needed for debugging
                filename: photoData.filename,
                cloudinaryPublicId: photoData.public_id
            }));

            console.log("[PhotoGrid] Photos array populated from Cloudinary:", this.photos.slice(0, 2)); // Log first 2 for brevity

            this.renderPhotoGrid();
            this.initiateGridExifLoading(); // This will now primarily update UI as EXIF is pre-fetched
            this.addMarkings(); 

        } catch (error) {
            console.error("[PhotoGrid] Error initializing photos from Cloudinary:", error);
            this.container.innerHTML = `<p style="color: red; text-align: center;">Error loading photos: ${error.message}. Check console for details.</p>`;
        }
    }

    renderPhotoGrid() {
        const photoGrid = document.querySelector('.photo-grid');
        if (!photoGrid) return; // Guard clause

        photoGrid.innerHTML = ''; // Clear previous grid
        const gridFragment = document.createDocumentFragment(); // Create a DocumentFragment

        const photosPerRow = 6; 
        const currentFilmStock = document.getElementById('film-stock-selector')?.value || 'portra';
        // const filmName = this.getFilmNameForStock(currentFilmStock); // filmName not used in this function

        for (let i = 0; i < this.photos.length; i += photosPerRow) {
            const rowPhotos = this.photos.slice(i, i + photosPerRow);
            
            const filmStripRow = document.createElement('div');
            filmStripRow.className = 'film-strip-row';

            const infoSegmentsContainer = document.createElement('div');
            infoSegmentsContainer.className = 'info-segments-container';
            filmStripRow.appendChild(infoSegmentsContainer);

            rowPhotos.forEach((photo, indexInRow) => {
                const infoSegment = document.createElement('div');
                infoSegment.className = 'info-segment';
                infoSegment.setAttribute('data-photo-id-info', photo.id);
                infoSegment.textContent = 'ISO... SS... F/...'; 
                infoSegmentsContainer.appendChild(infoSegment);
            });
            
            const photoFramesContainer = document.createElement('div');
            photoFramesContainer.className = 'photo-frames-container';

            rowPhotos.forEach((photo, indexInRow) => {
                const globalIndex = i + indexInRow;
                const frameNumber = this.getFrameNumberForPhoto(globalIndex);
                
                const photoFrame = document.createElement('div');
                photoFrame.className = 'photo-frame';
                photoFrame.setAttribute('data-photo-id', photo.id);

                photoFrame.innerHTML = `
                    <div class="photo-container">
                        <img src="${photo.src}" alt="Frame ${frameNumber}" class="photo-img" loading="lazy" data-photo-id="${photo.id}">
                    </div>
                    <div class="markup-overlay"></div>
                    <div class="frame-number">${frameNumber}</div>
                    <div class="mobile-exif-summary"></div> 
                    <div class="exif-data"></div>
                `;
                // console.log(`[Render] Created photoFrame HTML for ID ${photo.id}:`, photoFrame.innerHTML); // Log created HTML
                photoFramesContainer.appendChild(photoFrame);
            });
            filmStripRow.appendChild(photoFramesContainer); 
            gridFragment.appendChild(filmStripRow); // Append row to fragment
        }

        // Append all original rows from the fragment
        photoGrid.appendChild(gridFragment);

        // Duplicate all generated film-strip-rows for infinite scroll effect
        const originalRows = Array.from(photoGrid.children);
        const cloneFragment = document.createDocumentFragment(); // Fragment for clones
        originalRows.forEach(row => {
            const clonedRow = row.cloneNode(true);
            // Add data-is-clone attribute to photo-frames within the cloned row
            clonedRow.querySelectorAll('.photo-frame').forEach(frame => {
                frame.dataset.isClone = 'true';
            });
            cloneFragment.appendChild(clonedRow);
        });
        photoGrid.appendChild(cloneFragment); // Append all clones from fragment
        
        this.applyFilmStockStyleClasses(currentFilmStock);
        addPhotoClickHandlers(); 
    }
    
    getFrameNumberForPhoto(index) {
        const num = Math.floor(index / 2) + 1;
        const suffix = index % 2 === 0 ? '' : 'A';
        return `${num}${suffix}`;
    }

    setupEventListeners() {
        // Smooth scroll for navigation - no changes needed here
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(anchor.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });

        // Parallax scroll effect for the photo grid
        // const photoGrid = document.querySelector('.photo-grid');
        // if (photoGrid) {
        //     window.addEventListener('scroll', () => {
        //         const scrollY = window.scrollY;
        //         // Adjust the multiplier for more or less parallax effect
        //         // A value between 0.1 and 0.5 usually works well.
        //         // Negative value makes it scroll slower than the page (appears to move up as you scroll down)
        //         // Positive value makes it scroll faster than the page (appears to move down faster as you scroll down)
        //         const parallaxMultiplier = -0.5; // Changed from -0.2 to -0.5 for a more pronounced effect
        //         photoGrid.style.transform = `translateY(${scrollY * parallaxMultiplier}px)`;
        //     });
        // }
        // Scroll related animations (parallax for pen marks) were removed earlier.
        // If other scroll effects are desired, they can be added here.

        // Event listener for the new film stock dropdown
        const filmStockSelector = document.getElementById('film-stock-selector');
        if (filmStockSelector) {
            filmStockSelector.addEventListener('change', (event) => {
                const selectedStock = event.target.value;
                console.log('Selected film stock:', selectedStock);
                this.applyFilmStockStyle(selectedStock); // Call the new method
            });
        }

        // Event listener for the markup animation toggle
        const markupToggle = document.getElementById('markup-animation-toggle');
        if (markupToggle) {
            markupToggle.addEventListener('change', (event) => {
                if (event.target.checked) {
                    this.addMarkings();
                } else {
                    this.clearAllMarkings();
                }
            });
        }
    }

    hideLoadingScreen() {
        const loadingIndicator = document.querySelector('.loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
        }
    }

    applyFilmStockStyle(stockValue) {
        const FILM_STOCK_CLASSES = {
            'trix': 'film-stock-trix',
            'portra': 'film-stock-portra',
            'cinestill': 'film-stock-cinestill',
            'ektachrome': 'film-stock-ektachrome',
            'kodakgold': 'film-stock-kodakgold'
        };

        const body = document.body;
        // Remove all known film stock classes first to ensure a clean slate
        Object.values(FILM_STOCK_CLASSES).forEach(className => {
            body.classList.remove(className);
        });

        // Add the selected film stock class
        if (FILM_STOCK_CLASSES[stockValue]) {
            body.classList.add(FILM_STOCK_CLASSES[stockValue]);
        } else {
            // Fallback or default if stockValue is unknown (e.g., Portra)
            body.classList.add(FILM_STOCK_CLASSES['portra']); 
            console.warn(`Unknown film stock value: ${stockValue}. Defaulting to Portra.`);
        }

        this.updateFilmStripText(stockValue);
        this.updateEdgeMarkings(stockValue);
        
        document.querySelectorAll('.info-segment').forEach(segment => {
            const photoId = parseInt(segment.getAttribute('data-photo-id-info'));
            const photo = this.photos.find(p => p.id === photoId);
            if (photo) { 
                const isoValue = (photo.exifLoaded && photo.exif.iso && photo.exif.iso !== 'N/A') ? photo.exif.iso : '...';
                const shutterValue = (photo.exifLoaded && photo.exif.shutter && photo.exif.shutter !== 'N/A') ? photo.exif.shutter : 'SS...';
                const fStopValue = (photo.exifLoaded && photo.exif.fStop && photo.exif.fStop !== 'N/A') ? photo.exif.fStop : 'F/...';
                segment.textContent = `ISO ${isoValue} - ${shutterValue} - ${fStopValue}`;
            } else {
                segment.textContent = 'ISO... SS... F/...'; // Default placeholder
            }
        });

        this.applyFilmStockStyleClasses(stockValue); 
    }

    updateFilmStripText(stockValue) {
        const filmName = this.getFilmNameForStock(stockValue);
        const topFilmEdge = document.querySelector('.film-info.top-film-edge span:first-child');
        const bottomFilmEdge = document.querySelector('.film-info.bottom-film-edge span:first-child');
        if (topFilmEdge) topFilmEdge.textContent = filmName;
        if (bottomFilmEdge) bottomFilmEdge.textContent = filmName;
    }

    updateEdgeMarkings(stockValue) {
        const perforations = document.querySelectorAll('.film-perforations');
        const validStocks = ['trix', 'portra', 'cinestill', 'ektachrome', 'kodakgold'];

        perforations.forEach(perf => {
            // Remove all potential stock-specific marking classes first
            perf.classList.remove('trix-marks', 'portra-marks', 'cinestill-marks');

            // Add new class based on stock
            if (validStocks.includes(stockValue)) {
                perf.classList.add(`${stockValue}-marks`);
            }
        });
    }

    async extractExifData(photo) {
        console.log(`[EXIF] extractExifData called for: ${photo.src}. EXIF Loaded: ${photo.exifLoaded}`);
        if (photo.exifLoaded && photo.exif) {
            console.log(`[EXIF] Pre-loaded EXIF data for ${photo.src}:`, photo.exif);
            this.updatePhotoInfoSegment(photo);
            this.updateModalExifDisplay(photo);
            return photo;
        } else {
            console.warn(`[EXIF] Data not pre-loaded for ${photo.src}. Check serverless function.`);
            photo.exif = { iso: 'N/A', shutter: 'N/A', fStop: 'N/A', model: 'N/A', lens: 'N/A' };
            photo.exifLoaded = true;
            this.updatePhotoInfoSegment(photo);
            this.updateModalExifDisplay(photo);
            return photo;
        }
    }

    initiateGridExifLoading() {
        console.log("[GridExif] Initiating EXIF display for grid items.");
        const allFrames = document.querySelectorAll('.photo-frame');
        allFrames.forEach(frame => {
            const photoId = parseInt(frame.getAttribute('data-photo-id'));
            const photoData = this.photos.find(p => p.id === photoId);
            if (photoData && photoData.exifLoaded) {
                this.updatePhotoInfoSegment(photoData);
            }
        });
    }

    updatePhotoInfoSegment(photo) {
        console.log(`[InfoSegment] updatePhotoInfoSegment called for photo ID: ${photo.id}, Loaded: ${photo.exifLoaded}`);

        const infoSegments = document.querySelectorAll(`.info-segment[data-photo-id-info="${photo.id}"]`);
        infoSegments.forEach(infoSegment => {
            if (infoSegment) {
                const isoValue = (photo.exifLoaded && photo.exif && photo.exif.iso) ? photo.exif.iso : '...';
                const shutterValue = (photo.exifLoaded && photo.exif && photo.exif.shutter) ? photo.exif.shutter : 'SS...';
                const fStopValue = (photo.exifLoaded && photo.exif && photo.exif.fStop) ? photo.exif.fStop : 'F/...';
                infoSegment.textContent = `ISO ${isoValue} - ${shutterValue} - ${fStopValue}`;
            }
        });

        const mobileExifSummaries = document.querySelectorAll(`.mobile-exif-summary[data-photo-id-mobile-exif="${photo.id}"]`);
        mobileExifSummaries.forEach(summaryElement => {
            if (summaryElement) {
                const fStop = (photo.exifLoaded && photo.exif && photo.exif.fStop) ? photo.exif.fStop : 'F/...';
                const shutter = (photo.exifLoaded && photo.exif && photo.exif.shutter) ? photo.exif.shutter : 'SS...';
                summaryElement.textContent = `${fStop} · ${shutter}`;
            }
        });
    }

    updateModalExifDisplay(photo) {
        const frame = document.querySelector(`.photo-frame[data-photo-id="${photo.id}"]`);
        if (frame) {
            const exifDataElement = frame.querySelector('.exif-data');
            if (exifDataElement) {
                exifDataElement.innerHTML = `Camera: ${photo.exif.camera}<br>Lens: ${photo.exif.lens}<br>Details: ${photo.exif.fStop} | ${photo.exif.shutter} | ISO ${photo.exif.iso}`;
            }
        }
    }

    // Helper to get film name string
    getFilmNameForStock(stockValue) {
        switch (stockValue) {
            case 'trix': return 'KODAK TRI-X 400';
            case 'portra': return 'KODAK PORTRA 400';
            case 'cinestill': return 'CINESTILL 800T';
            case 'ektachrome': return 'KODAK EKTACHROME E100';
            case 'kodakgold': return 'KODAK GOLD 200';
            default: return 'UNKNOWN FILM';
        }
    }

    // New method to apply styling classes to info segments based on film stock
    applyFilmStockStyleClasses(stockValue) {
        document.querySelectorAll('.info-segments-container').forEach(container => {
            container.classList.remove('trix-style', 'portra-style', 'cinestill-style', 'ektachrome-style', 'kodakgold-style', 'rolleiir-style');
            if (stockValue === 'trix') container.classList.add('trix-style');
            else if (stockValue === 'portra') container.classList.add('portra-style');
            else if (stockValue === 'cinestill') container.classList.add('cinestill-style');
            else if (stockValue === 'ektachrome') container.classList.add('ektachrome-style');
            else if (stockValue === 'kodakgold') container.classList.add('kodakgold-style');
        });
    }

    addMarkings() {
        console.log("[Markings] Adding scroll-triggered markings...");
        this.clearAllMarkings(); // Clear previous markings and reset state

        const percentToMark = 0.20;
        const numPhotosToMark = Math.floor(this.photos.length * percentToMark);
        const markTypes = ['circle', 'underline', 'square'];

        // 1. Determine Photos to Mark (Random Selection)
        let allPhotosCopy = [...this.photos];
        // Fisher-Yates (aka Knuth) Shuffle for the copy
        for (let i = allPhotosCopy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allPhotosCopy[i], allPhotosCopy[j]] = [allPhotosCopy[j], allPhotosCopy[i]];
        }
        const randomlySelectedPhotos = allPhotosCopy.slice(0, numPhotosToMark);
        const idsToMarkRandomly = new Set(randomlySelectedPhotos.map(p => p.id));

        console.log(`[Markings] Will mark ${idsToMarkRandomly.size} random photos on scroll. Sample IDs:`, Array.from(idsToMarkRandomly).slice(0, 10));

        const allFrames = document.querySelectorAll('.photo-frame');

        // 2. Setup observers for all marked frames
        const observerOptions = {
            root: null, // relative to the viewport
            rootMargin: '0px',
            threshold: 0.5 // Changed from 0.1 to 0.5
        };

        allFrames.forEach(frame => {
            const photoId = parseInt(frame.dataset.photoId);
            if (idsToMarkRandomly.has(photoId)) {
                const observerCallback = (entries, observerInstance) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting && !frame.dataset.isMarked) {
                            let markType;
                            do {
                                markType = markTypes[Math.floor(Math.random() * markTypes.length)];
                            } while (markTypes.length > 1 && markType === this.lastTriggeredMarkType);
                            this.lastTriggeredMarkType = markType;

                            // Add to queue for animation
                            this.scrollAnimationQueue.push({ frame, markType });
                            this.processScrollAnimationQueue(); // Attempt to process the queue

                            observerInstance.unobserve(frame); // Stop observing once queued
                        }
                    });
                };
                const observer = new IntersectionObserver(observerCallback, observerOptions);
                observer.observe(frame);
            }
        });
        // The initial animation sequence for visible items is removed.
        // All marking animations are now handled by the IntersectionObserver and the queue.
    }

    drawMark(overlayElement, markType, animationDelay, animationDuration) { 
        const svgNS = "http://www.w3.org/2000/svg";
        let svg = overlayElement.querySelector('svg');
        if (!svg) {
            svg = document.createElementNS(svgNS, "svg");
            svg.setAttribute("viewBox", "0 0 100 100"); 
            svg.style.width = "100%";
            svg.style.height = "100%";
            overlayElement.appendChild(svg); 
        } else {
            // If SVG exists, clear its previous content before drawing new marks
            svg.innerHTML = ''; 
        }

        let elementsToAnimate = [];
        // Highlighter style: thicker stroke
        const highlighterStrokeWidth = (8 + Math.random() * 4).toFixed(1) + 'px'; 
        const highlighterColor = "#FFFD77"; // A typical highlighter yellow
        const highlighterOpacity = "0.6"; // Semi-transparent

        if (markType === 'circle') {
            const pathElement = document.createElementNS(svgNS, "path");
            const centerX = 50;
            const centerY = 50;
            const baseRadius = 45 + (Math.random() - 0.5) * 4; 
            const segments = 20; 
            let pathData = "M"; // Start with MoveTo command
            for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * (2 * Math.PI);
                const jitterRadius = baseRadius + (Math.random() - 0.5) * 4; 
                const jitterAngle = angle + (Math.random() - 0.5) * (Math.PI / segments / 4); 
                const x = centerX + jitterRadius * Math.cos(jitterAngle) + (Math.random() - 0.5) * 2;
                const y = centerY + jitterRadius * Math.sin(jitterAngle) + (Math.random() - 0.5) * 2;
                // Add L for LineTo command only for points after the first one
                pathData += `${i === 0 ? '' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
            }
            pathData += " Z"; // Close the path
            pathElement.setAttribute("d", pathData);
            elementsToAnimate.push(pathElement);
        } else if (markType === 'underline') {
            const pathElement = document.createElementNS(svgNS, "path");
            const startX = 10 + Math.random() * 15; 
            const endX = 90 - Math.random() * 15;   
            const yPos = 80 + Math.random() * 10;   
            
            const cp1X = startX + (endX - startX) * 0.25 + (Math.random() - 0.5) * 20;
            const cp1Y = yPos + (Math.random() - 0.5) * 15;
            const cp2X = startX + (endX - startX) * 0.75 + (Math.random() - 0.5) * 20;
            const cp2Y = yPos + (Math.random() - 0.5) * 15;

            let pathData = `M ${startX.toFixed(2)} ${yPos.toFixed(2)} C ${cp1X.toFixed(2)} ${cp1Y.toFixed(2)}, ${cp2X.toFixed(2)} ${cp2Y.toFixed(2)}, ${endX.toFixed(2)} ${yPos.toFixed(2)}`;
            pathElement.setAttribute("d", pathData);
            pathElement.style.fill = 'none'; 
            elementsToAnimate.push(pathElement);
        } else if (markType === 'square') {
            const pathElement = document.createElementNS(svgNS, "path");
            const margin = 15; // Margin from edge of SVG viewbox
            const size = 70;   // Base size of the square
            const jitter = 8; // Max jitter for points

            // Define corners with jitter
            const p1x = margin + (Math.random() - 0.5) * jitter;
            const p1y = margin + (Math.random() - 0.5) * jitter;
            const p2x = margin + size + (Math.random() - 0.5) * jitter;
            const p2y = margin + (Math.random() - 0.5) * jitter;
            const p3x = margin + size + (Math.random() - 0.5) * jitter;
            const p3y = margin + size + (Math.random() - 0.5) * jitter;
            const p4x = margin + (Math.random() - 0.5) * jitter;
            const p4y = margin + size + (Math.random() - 0.5) * jitter;

            let pathData = `M ${p1x.toFixed(2)} ${p1y.toFixed(2)} L ${p2x.toFixed(2)} ${p2y.toFixed(2)} L ${p3x.toFixed(2)} ${p3y.toFixed(2)} L ${p4x.toFixed(2)} ${p4y.toFixed(2)} Z`;
            pathElement.setAttribute("d", pathData);
            elementsToAnimate.push(pathElement);
        }

        elementsToAnimate.forEach((el) => {
            svg.appendChild(el);
            el.style.stroke = highlighterColor; // Set highlighter color
            el.style.strokeWidth = highlighterStrokeWidth; // Set highlighter stroke width
            el.style.strokeOpacity = highlighterOpacity; // Set highlighter opacity
            el.style.strokeLinecap = "round"; // Rounded ends for highlighter feel
            el.style.strokeLinejoin = "round"; // Rounded joins for highlighter feel


            const length = el.getTotalLength ? el.getTotalLength() : 250; 
            
            el.style.strokeDasharray = length;
            el.style.strokeDashoffset = length;
            
            el.style.animation = `draw ${animationDuration} ease-out forwards`; 
            el.style.animationDelay = animationDelay; 
        });
    }

    clearAllMarkings() {
        console.log("[Markings] Clearing all markings and observer states.");
        const overlays = document.querySelectorAll('.markup-overlay');
        overlays.forEach(overlay => {
            overlay.innerHTML = ''; // Remove SVG elements
        });

        const allFrames = document.querySelectorAll('.photo-frame');
        allFrames.forEach(frame => {
            delete frame.dataset.isMarked; // Remove the marked flag
        });
        
        this.lastTriggeredMarkType = null; // Reset last triggered mark type

        // Observers will unobserve themselves, so no global observer list to clear,
        // but if addMarkings is called again, new observers will be created.
        // This is generally fine. If an old observer was somehow still active and triggered,
        // !frame.dataset.isMarked would fail if clearAllMarkings wasn't called first.
        // Calling clearAllMarkings at the start of addMarkings handles this.
    }

    async processScrollAnimationQueue() {
        if (this.isScrollAnimationPlaying || this.scrollAnimationQueue.length === 0) {
            return;
        }

        this.isScrollAnimationPlaying = true;
        const itemToAnimate = this.scrollAnimationQueue.shift(); // Get the first item
        const { frame, markType } = itemToAnimate;

        // Parallax effect: Delay animation until item is visible and a short pause has passed.
        // The IntersectionObserver threshold (0.1) means it's already partially visible.
        // This 500ms delay is after it has crossed that threshold.
        await new Promise(resolve => setTimeout(resolve, 1000)); // Changed from 500 to 1000

        // Check if the frame is still in the DOM (e.g., if content was rapidly re-rendered)
        if (!document.body.contains(frame)) {
            console.warn("[ScrollQueue] Frame removed before animation could start.");
            this.isScrollAnimationPlaying = false;
            this.processScrollAnimationQueue(); // Process next
            return;
        }

        const overlay = frame.querySelector('.markup-overlay');
        const markAnimationDuration = (0.2 + Math.random() * 0.3).toFixed(1); // seconds
        
        if (overlay) {
            // The actual animation has 0s delay here, as the pause was handled above
            this.drawMark(overlay, markType, '0s', markAnimationDuration + 's');
        }
        frame.dataset.isMarked = 'true'; // Mark it as animated

        // Wait for the drawing animation to finish
        await new Promise(resolve => setTimeout(resolve, parseFloat(markAnimationDuration) * 1000));

        this.isScrollAnimationPlaying = false;
        this.processScrollAnimationQueue(); // Attempt to process the next item
    }
}

async function startLandingSequence() {
    const overlay = document.getElementById('landing-sequence-overlay');
    const landingImage = document.getElementById('landing-image'); // This element might still be in HTML
    const mainContent = document.getElementById('main-content-wrapper');

    console.log("[Landing] Preparing to show main content. Bypassing old local image sequence.");

    if (overlay) {
        overlay.style.opacity = '0'; // Start fading out
        await new Promise(resolve => setTimeout(resolve, 300)); // Short delay for fade
        overlay.style.display = 'none';
    } else {
        console.warn("[Landing] Landing sequence overlay not found.");
    }
    
    showMainContentAndInitPortfolio();
}

function showMainContentAndInitPortfolio() {
    const mainContent = document.getElementById('main-content-wrapper');
    if (mainContent) {
        mainContent.style.display = 'block';
    } else {
        console.error("CRITICAL: Main content wrapper ('main-content-wrapper') not found. Site cannot be displayed.");
        document.body.innerHTML = "<p style='color:red; text-align:center; font-size:1.2em;'>Site Error: Main content area missing.</p>";
        return; // Stop if main content area is missing
    }

    window.portfolio = new PhotographyPortfolio(); // Make instance globally accessible

    console.log(
`🖼️ CLOUDINARY PHOTO MODE:
- Attempting to load photos from Cloudinary via API.
- EXIF data should be pre-fetched by the serverless function.`
    );
}

document.addEventListener('DOMContentLoaded', () => {
    // Directly call startLandingSequence, which now handles showing main content and initializing.
    startLandingSequence();
});

function addPhotoClickHandlers() {
    document.querySelectorAll('.photo-frame').forEach(frame => {
        frame.removeEventListener('click', handlePhotoFrameClick); 
        frame.addEventListener('click', handlePhotoFrameClick);    
    });
}

// Add a helper function to format shutter speed if it's a fraction
function formatShutterSpeed(speedIn, originalSpeedStringFallback) {
    console.log(`[formatShutterSpeed] Received speedIn: ${speedIn} (type: ${typeof speedIn}), originalFallback: ${originalSpeedStringFallback}`);
    let numericSpeed;

    if (typeof speedIn === 'number' && !isNaN(speedIn)) {
        numericSpeed = speedIn;
        console.log(`[formatShutterSpeed] speedIn is a number. numericSpeed: ${numericSpeed}`);
    } else if (typeof speedIn === 'string') {
        console.log(`[formatShutterSpeed] speedIn is a string.`);
        if (speedIn.includes('/') && !speedIn.startsWith('0')) {
            console.log(`[formatShutterSpeed] speedIn is already a fraction: ${speedIn}. Returning.`);
            return speedIn; 
        }
        numericSpeed = parseFloat(speedIn);
        console.log(`[formatShutterSpeed] Parsed speedIn string to numericSpeed: ${numericSpeed} (type: ${typeof numericSpeed})`);
    }

    if (typeof numericSpeed === 'number' && !isNaN(numericSpeed)) {
        console.log(`[formatShutterSpeed] Processing numericSpeed: ${numericSpeed}`);
        if (numericSpeed < 1 && numericSpeed > 0) { 
            console.log(`[formatShutterSpeed] numericSpeed is < 1 and > 0.`);
            const denominator = Math.round(1 / numericSpeed);
            console.log(`[formatShutterSpeed] Calculated denominator: ${denominator}`);
            if (denominator > 0) { 
                 const fraction = `1/${denominator}`;
                 console.log(`[formatShutterSpeed] Returning fraction: ${fraction}`);
                 return fraction; 
            }
        }
        const roundedSpeed = `${Math.round(numericSpeed)}s`;
        console.log(`[formatShutterSpeed] numericSpeed is >= 1 or denominator was <= 0. Returning: ${roundedSpeed}`);
        return roundedSpeed; 
    }
    
    console.log(`[formatShutterSpeed] Fallback: numericSpeed is not a usable number. Returning originalSpeedStringFallback: ${originalSpeedStringFallback}`);
    return String(originalSpeedStringFallback);
}

async function handlePhotoFrameClick() {
    const photoId = parseInt(this.getAttribute('data-photo-id'));
    const photoData = window.portfolio.photos.find(p => p.id === photoId);
    console.log(`[ModalClick] Clicked photo ID ${photoId}. Found photoData:`, photoData ? photoData.src : 'not found');

    if (photoData) {
        const frameNumber = window.portfolio.getFrameNumberForPhoto(photoData.id - 1);
        let exifHtml;

        const createExifRow = (label, value) => {
            const val = value || 'N/A';
            return `<div class="modal-exif-entry"><span class="modal-exif-label">${label}:</span><span class="modal-exif-value">${val}</span></div>`;
        };

        if (photoData.exifLoaded) {
            exifHtml = createExifRow('Camera', photoData.exif.camera) +
                       createExifRow('Lens', photoData.exif.lens) +
                       createExifRow('Aperture', photoData.exif.fStop) +
                       createExifRow('ISO', photoData.exif.iso) +
                       createExifRow('Shutter', photoData.exif.shutter);
            createPhotoModal(photoData.src, frameNumber, exifHtml);
        } else {
            const loadingExifMessage = '<div class="modal-exif-entry"><span class="modal-exif-value">Loading EXIF details...</span></div>';
            createPhotoModal(photoData.src, frameNumber, loadingExifMessage);
            
            await window.portfolio.extractExifData(photoData);
            
            exifHtml = createExifRow('Camera', photoData.exif.camera) +
                       createExifRow('Lens', photoData.exif.lens) +
                       createExifRow('Aperture', photoData.exif.fStop) +
                       createExifRow('ISO', photoData.exif.iso) +
                       createExifRow('Shutter', photoData.exif.shutter);
            
            const modalExifContent = document.querySelector('.photo-modal .exif-content-area');
            if (modalExifContent) { 
                 modalExifContent.innerHTML = exifHtml;
            }
        }
    } else {
        console.error("Could not find photo data for ID:", photoId);
    }
}

function createPhotoModal(imageSrc, frameNumber, exifHtml) {
    const existingModal = document.querySelector('.photo-modal');
    if (existingModal) {
        document.body.removeChild(existingModal);
    }

    const modal = document.createElement('div');
    modal.className = 'photo-modal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.95); display: flex; align-items: center; justify-content: center;
        z-index: 10001; opacity: 0; transition: opacity 0.3s ease;
    `;
    
    modal.innerHTML = `
        <div style="max-width: 90%; max-height: 90%; display: flex; flex-direction: column; align-items: center; gap: 20px; padding:20px; background: #111; border-radius: 5px; box-shadow: 0 0 30px rgba(0,0,0,0.5);">
            <div style="text-align: center; position:relative; width: auto; height: 75vh;">
                <img src="${imageSrc}" style="max-width: 100%; max-height: 100%; object-fit: contain; border: 1px solid #222;">
            </div>
            <div style="text-align: left; min-width: 280px; max-width: 500px; color: #ccc; font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; line-height: 1.7; background: #1a1a1a; padding: 15px; border-radius: 3px;">
                <h4 style="margin-top:0; margin-bottom: 12px; color: #eee; font-weight: 500; font-size: 0.9rem; border-bottom: 1px solid #333; padding-bottom: 8px;">FRAME ${frameNumber} - DETAILS</h4>
                <div class="exif-content-area">${exifHtml}</div>
            </div>
        </div>
        <div class="modal-close-button" style="position: absolute; top: 25px; right: 30px; color: #fff; cursor: pointer; font-size: 2rem; opacity: 0.7; font-family: Arial, sans-serif;">&times;</div>
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => modal.style.opacity = '1', 10);
    
    const closeButton = modal.querySelector('.modal-close-button');
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target === closeButton) {
            modal.style.opacity = '0';
            setTimeout(() => { 
                if (document.body.contains(modal)) {
                    document.body.removeChild(modal);
                }
            }, 300);
        }
    });
}
