// Photography Portfolio JavaScript
// Authentic Film Contact Sheet with EXIF Data

const TOTAL_AVAILABLE_PHOTOS = 106; // Define this at the top for the landing sequence

class PhotographyPortfolio {
    constructor() {
        this.photos = [];
        this.totalPhotos = 106; // Total number of local photos
        this.scrollY = 0;
        this.lastTriggeredMarkType = null; // For ensuring mark variety with IntersectionObserver
        this.scrollAnimationQueue = []; // Queue for scroll-triggered animations
        this.isScrollAnimationPlaying = false; // Flag to manage sequential scroll animations
        this.init();
    }

    init() {
        this.loadPhotos();
        this.setupEventListeners();
        this.applyFilmStockStyle('cinestill'); // Changed default to 'cinestill'
        // Also update the dropdown to reflect this default
        const filmStockSelector = document.getElementById('film-stock-selector');
        if (filmStockSelector) {
            filmStockSelector.value = 'cinestill';
        }
    }

    loadPhotos() {
        this.photos = [];
        for (let i = 1; i <= this.totalPhotos; i++) {
            const photoSrc = `images/photo-${i}.jpg`;
            this.photos.push({
                id: i,
                src: photoSrc,
                exif: { camera: 'Loading...', lens: 'Loading...', fStop: 'Loading...', iso: 'Loading...', shutter: 'Loading...' },
                exifLoaded: false // Flag to track if EXIF has been loaded
            });
        }
        this.shufflePhotos(); // Randomize the photo order
        this.renderPhotoGrid();
        this.hideLoadingScreen(); // Hide loading screen after initial render
        this.initiateGridExifLoading(); // MOVED HERE: Call after grid and clones are fully rendered
        
        // Conditionally add markings based on checkbox
        const markupToggle = document.getElementById('markup-animation-toggle');
        if (markupToggle && markupToggle.checked) {
            this.addMarkings(); 
        }
    }

    // Fisher-Yates (aka Knuth) Shuffle algorithm
    shufflePhotos() {
        let currentIndex = this.photos.length, randomIndex;
        // While there remain elements to shuffle.
        while (currentIndex !== 0) {
            // Pick a remaining element.
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            // And swap it with the current element.
            [this.photos[currentIndex], this.photos[randomIndex]] = [
                this.photos[randomIndex], this.photos[currentIndex]];
        }
    }

    // Now takes a photo object and returns a Promise
    extractExifData(photo) {
        console.log(`[EXIF] Attempting to extract EXIF for: ${photo.src}`);
        return new Promise((resolve) => {
            if (photo.exifLoaded) {
                console.log(`[EXIF] Data already loaded/attempted for: ${photo.src}`);
                resolve(photo); // Resolve with the photo object itself, even if already loaded
                return;
            }

            const img = new Image();
            img.src = photo.src;

            img.onload = () => {
                console.log(`[EXIF] Image loaded (img.onload) for: ${photo.src}`);
                try {
                    EXIF.getData(img, () => {
                        console.log(`[EXIF] EXIF.getData callback entered for: ${photo.src}`);
                        const make = EXIF.getTag(img, "Make");
                        const model = EXIF.getTag(img, "Model");
                        const fNumber = EXIF.getTag(img, "FNumber");
                        const iso = EXIF.getTag(img, "ISOSpeedRatings");
                        const focalLength = EXIF.getTag(img, "FocalLength");
                        
                        let rawExposureTime = EXIF.getTag(img, "ExposureTime");
                        let numericExposureTime;

                        if (typeof rawExposureTime === 'object' && rawExposureTime.numerator && rawExposureTime.denominator) {
                            // It's a Rational object from EXIF.js
                            if (rawExposureTime.denominator !== 0) {
                                numericExposureTime = rawExposureTime.numerator / rawExposureTime.denominator;
                            } else {
                                numericExposureTime = 0; // Or handle as error/infinity appropriately
                            }
                            console.log(`[EXIF] Converted Rational ExposureTime: ${rawExposureTime.numerator}/${rawExposureTime.denominator} to ${numericExposureTime}`);
                        } else if (typeof rawExposureTime === 'string') {
                            numericExposureTime = parseFloat(rawExposureTime);
                        } else if (typeof rawExposureTime === 'number') {
                            numericExposureTime = rawExposureTime;
                        } else {
                            numericExposureTime = NaN; // Unable to determine numeric value
                        }

                        console.log(`[EXIF] Data for ${photo.src}: Make=${make}, Model=${model}, F#=${fNumber}, ISO=${iso}, FocalLength=${focalLength}, Shutter=${rawExposureTime}`);

                        photo.exif = {
                            camera: make && model ? `${make} ${model}` : (make || model || 'N/A'),
                            lens: focalLength ? `${focalLength}mm` : 'N/A',
                            fStop: fNumber ? `f/${fNumber}` : 'N/A',
                            iso: iso ? `${iso}` : 'N/A',
                            shutter: formatShutterSpeed(numericExposureTime, String(rawExposureTime)) // Pass numeric and ORIGINAL raw as string
                        };
                        photo.exifLoaded = true;
                        resolve(photo); // Resolve with photo data
                    });
                } catch (e) {
                    console.error(`[DEBUG] Error during EXIF processing for ${photo.src}:`, e);
                    photo.exif = { camera: 'EXIF Error', lens: 'EXIF Error', fStop: 'EXIF Error', iso: 'EXIF Error', shutter: 'EXIF Error' };
                    photo.exifLoaded = true;
                    resolve(photo); // Resolve even on error
                }
            };

            img.onerror = () => {
                console.error(`[DEBUG] Failed to load image (img.onerror): ${photo.src}`);
                photo.exif = { camera: 'Load Error', lens: 'Load Error', fStop: 'Load Error', iso: 'Load Error', shutter: 'Load Error' };
                photo.exifLoaded = true;
                resolve(photo); // Resolve even on error
            };
        });
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
                    <div class="exif-data"></div>
                `;
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

    // Removed initiateGridExifLoading() method as it's no longer needed
    /*
    initiateGridExifLoading() {
        const observerOptions = {
            root: null, // observes intersections relative to the viewport
            rootMargin: '0px',
            threshold: 0.1 // Callback is run when 10% of the item is visible
        };

        const observerCallback = async (entries, observer) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    const frame = entry.target;
                    const photoId = parseInt(frame.getAttribute('data-photo-id'));
                    const gridExifRendered = frame.getAttribute('data-grid-exif-rendered') === 'true';

                    if (!gridExifRendered) {
                        console.log(`[Observer] Frame for photo ID ${photoId} is intersecting. gridExifRendered: ${gridExifRendered}`);
                        const photoData = this.photos.find(p => p.id === photoId);
                        if (photoData) {
                            if (!photoData.exifLoaded) {
                                console.log(`[Observer] EXIF not loaded for ${photoData.src}. Calling extractExifData.`);
                                await this.extractExifData(photoData);
                            }
                            console.log(`[Observer] Updating grid EXIF display for ${photoData.src}`);
                            this.updateGridExifDisplay(frame, photoData);
                            frame.setAttribute('data-grid-exif-rendered', 'true');
                        }
                    }
                }
            }
        };

        const observer = new IntersectionObserver(observerCallback, observerOptions);
        const frames = document.querySelectorAll('.photo-frame');
        frames.forEach(frame => observer.observe(frame));
    }
    */

    // updateGridExifDisplay() is no longer used for on-grid EXIF.
    // Commenting it out. It might be removed fully if not used by other logic implicitly.
    /*
    updateGridExifDisplay(frameElement, photoData) {
        console.log(`[GridDisplay] Updating for photo: ${photoData ? photoData.src : 'undefined'}, EXIF loaded: ${photoData ? photoData.exifLoaded : 'undefined'}`);

        const mmValue = frameElement.querySelector('.mm-value');
        const shutterValue = frameElement.querySelector('.shutter-value');
        const fstopValue = frameElement.querySelector('.fstop-value');

        if (!mmValue || !shutterValue || !fstopValue) { 
            console.error('[GridDisplay] One or more EXIF span elements not found in frame:', frameElement);
            return;
        }

        if (!photoData || !photoData.exifLoaded) {
            console.log(`[GridDisplay] EXIF not loaded or no photoData for ${frameElement.getAttribute('data-photo-id')}. Showing placeholders.`);
            mmValue.textContent = '...';
            shutterValue.textContent = '...';
            fstopValue.textContent = '...';
            return;
        }

        const getExif = (key) => photoData.exif[key] || '-';

        mmValue.textContent = getExif('lens').replace('mm', '');
        shutterValue.textContent = getExif('shutter');
        fstopValue.textContent = getExif('fStop').replace('f/', '');

        frameElement.querySelectorAll('.grid-exif-item.mm-value, .grid-exif-item.shutter-value, .grid-exif-item.fstop-value').forEach(el => el.style.opacity = '1');
        frameElement.querySelectorAll('.grid-exif-item.mm-label, .grid-exif-item.shutter-speed-label, .grid-exif-item.fstop-label').forEach(el => el.style.opacity = '1');
    }
    */

    applyFilmStockStyle(stockValue) {
        const body = document.body;
        body.classList.remove('film-stock-trix', 'film-stock-portra', 'film-stock-cinestill');

        if (stockValue === 'trix') body.classList.add('film-stock-trix');
        else if (stockValue === 'portra') body.classList.add('film-stock-portra');
        else if (stockValue === 'cinestill') body.classList.add('film-stock-cinestill');

        this.updateFilmStripText(stockValue); // Updates header/footer film name
        
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
        const filmInfoSpans = document.querySelectorAll('.sheet-header .film-info span:first-child, .sheet-footer .film-info span:first-child');
        let filmName = 'KODAK TRI-X 400'; // Default
        if (stockValue === 'portra') {
            filmName = 'KODAK PORTRA 400';
        } else if (stockValue === 'cinestill') {
            filmName = 'CINESTILL 800T';
        }
        filmInfoSpans.forEach(span => span.textContent = filmName);
    }

    updateEdgeMarkings(stockValue) {
        const leftPerf = document.querySelector('.film-perforations.left');
        const rightPerf = document.querySelector('.film-perforations.right');
        // Select ALL horizontal-film-info elements, as there's one per row now
        const horizontalInfoElements = document.querySelectorAll('.horizontal-film-info');

        // Combine vertical perforations and all horizontal info elements
        let elementsToUpdate = [];
        if (leftPerf) elementsToUpdate.push(leftPerf);
        if (rightPerf) elementsToUpdate.push(rightPerf);
        elementsToUpdate = elementsToUpdate.concat(Array.from(horizontalInfoElements));
        
        // Remove old top/bottom edge code selectors as they are no longer used
        // const topHorizontalCodes = document.querySelector('.horizontal-edge-codes.top-edge-codes');
        // const bottomHorizontalCodes = document.querySelector('.horizontal-edge-codes.bottom-edge-codes');
        // elementsToUpdate = [leftPerf, rightPerf, topHorizontalCodes, bottomHorizontalCodes].filter(el => el !== null);


        elementsToUpdate.forEach(el => {
            if (!el) return; // Skip if an element wasn't found
            // Remove existing marking classes
            el.classList.remove('trix-marks', 'portra-marks', 'cinestill-marks');

            // Add new class based on stock
            if (stockValue === 'trix') {
                el.classList.add('trix-marks');
            } else if (stockValue === 'portra') {
                el.classList.add('portra-marks');
            } else if (stockValue === 'cinestill') {
                el.classList.add('cinestill-marks');
            }
        });
    }

    initiateGridExifLoading() {
        const observerOptions = {
            root: null,
            rootMargin: '200px', // Load EXIF for images 200px before they enter viewport
            threshold: 0.01 
        };

        const observerCallback = async (entries, observer) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    const frame = entry.target; // This will be the photo-frame
                    const photoId = parseInt(frame.getAttribute('data-photo-id'));
                    const photoData = this.photos.find(p => p.id === photoId);

                    if (photoData && !photoData.exifLoaded) {
                        console.log(`[Observer] EXIF not loaded for ${photoData.src}. Calling extractExifData.`);
                        await this.extractExifData(photoData); // Ensure extractExifData updates the segment
                        // No longer need to call updateGridExifDisplay here as that was for old on-grid display
                        observer.unobserve(frame); // Stop observing once EXIF is fetched
                    } else if (photoData && photoData.exifLoaded) {
                         // If EXIF was already loaded (e.g. from a previous modal view), ensure segment is updated
                        this.updatePhotoInfoSegment(photoData);
                        observer.unobserve(frame);
                    }
                }
            }
        };

        const observer = new IntersectionObserver(observerCallback, observerOptions);
        // We observe .photo-frame elements as they are what actually scroll into view
        const frames = document.querySelectorAll('.photo-frame');
        frames.forEach(frame => observer.observe(frame));
    }

    // Modified extractExifData to call updatePhotoInfoSegment
    async extractExifData(photo) { // Made async
        console.log(`[EXIF] Attempting to extract EXIF for: ${photo.src}`);
        return new Promise((resolve) => {
            if (photo.exifLoaded) {
                console.log(`[EXIF] Data already loaded/attempted for: ${photo.src}`);
                this.updatePhotoInfoSegment(photo); // Update segment even if loaded before
                resolve(photo);
                return;
            }

            const img = new Image();
            img.src = photo.src;

            img.onload = () => {
                console.log(`[EXIF] Image loaded (img.onload) for: ${photo.src}`);
                try {
                    EXIF.getData(img, () => {
                        console.log(`[EXIF] EXIF.getData callback entered for: ${photo.src}`);
                        const make = EXIF.getTag(img, "Make");
                        const model = EXIF.getTag(img, "Model");
                        const fNumber = EXIF.getTag(img, "FNumber");
                        const iso = EXIF.getTag(img, "ISOSpeedRatings");
                        const focalLength = EXIF.getTag(img, "FocalLength");
                        
                        let rawExposureTime = EXIF.getTag(img, "ExposureTime");
                        let numericExposureTime;

                        if (typeof rawExposureTime === 'object' && rawExposureTime.numerator && rawExposureTime.denominator) {
                            // It's a Rational object from EXIF.js
                            if (rawExposureTime.denominator !== 0) {
                                numericExposureTime = rawExposureTime.numerator / rawExposureTime.denominator;
                            } else {
                                numericExposureTime = 0; // Or handle as error/infinity appropriately
                            }
                            console.log(`[EXIF] Converted Rational ExposureTime: ${rawExposureTime.numerator}/${rawExposureTime.denominator} to ${numericExposureTime}`);
                        } else if (typeof rawExposureTime === 'string') {
                            numericExposureTime = parseFloat(rawExposureTime);
                        } else if (typeof rawExposureTime === 'number') {
                            numericExposureTime = rawExposureTime;
                        } else {
                            numericExposureTime = NaN; // Unable to determine numeric value
                        }

                        photo.exif = {
                            camera: make && model ? `${make} ${model}` : (make || model || 'N/A'),
                            lens: focalLength ? `${focalLength}mm` : 'N/A',
                            fStop: fNumber ? `f/${fNumber}` : 'N/A',
                            iso: iso ? `${iso}` : 'N/A', 
                            shutter: formatShutterSpeed(numericExposureTime, String(rawExposureTime)) // Pass numeric and ORIGINAL raw as string
                        };
                        photo.exifLoaded = true;
                        this.updatePhotoInfoSegment(photo); // Update the info segment
                        resolve(photo);
                    });
                } catch (e) {
                    console.error(`[DEBUG] Error during EXIF processing for ${photo.src}:`, e);
                    photo.exif = { camera: 'EXIF Error', lens: 'EXIF Error', fStop: 'EXIF Error', iso: 'Error', shutter: 'EXIF Error' };
                    photo.exifLoaded = true;
                    this.updatePhotoInfoSegment(photo); // Update with error state
                    resolve(photo);
                }
            };

            img.onerror = () => {
                console.error(`[DEBUG] Failed to load image (img.onerror): ${photo.src}`);
                photo.exif = { camera: 'Load Error', lens: 'Load Error', fStop: 'Load Error', iso: 'Error', shutter: 'Load Error' };
                photo.exifLoaded = true;
                this.updatePhotoInfoSegment(photo); // Update with error state
                resolve(photo);
            };
        });
    }
    
    updatePhotoInfoSegment(photo) {
        const infoSegments = document.querySelectorAll(`.info-segment[data-photo-id-info="${photo.id}"]`); // Use querySelectorAll
        if (infoSegments.length > 0) {
            infoSegments.forEach(segment => { // Iterate over all found segments
                const isoValue = (photo.exifLoaded && photo.exif.iso && photo.exif.iso !== 'N/A') ? photo.exif.iso : '...';
                const shutterValue = (photo.exifLoaded && photo.exif.shutter && photo.exif.shutter !== 'N/A') ? photo.exif.shutter : 'SS...';
                const fStopValue = (photo.exifLoaded && photo.exif.fStop && photo.exif.fStop !== 'N/A') ? photo.exif.fStop : 'F/...';
                segment.textContent = `ISO ${isoValue} - ${shutterValue} - ${fStopValue}`;
            });
        } else {
             console.warn(`[InfoSegment] No info segment found for photo ID: ${photo.id}`);
        }
    }

    // Helper to get film name string
    getFilmNameForStock(stockValue) {
        if (stockValue === 'portra') return 'KODAK PORTRA 400';
        if (stockValue === 'cinestill') return 'CINESTILL 800T';
        // Ensure KODAK TX 400 is the fallback if stockValue is 'trix' or unexpected
        return 'KODAK TX 400'; 
    }

    // New method to apply styling classes to info segments based on film stock
    applyFilmStockStyleClasses(stockValue) {
        document.querySelectorAll('.info-segments-container').forEach(container => {
            container.classList.remove('trix-style', 'portra-style', 'cinestill-style');
            if (stockValue === 'trix') container.classList.add('trix-style');
            else if (stockValue === 'portra') container.classList.add('portra-style');
            else if (stockValue === 'cinestill') container.classList.add('cinestill-style');
        });
    }

    addMarkings() {
        console.log("[Markings] Adding scroll-triggered markings...");
        this.clearAllMarkings(); // Clear previous markings and reset state

        const percentToMark = 0.30;
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
            threshold: 0.1 // Trigger when 10% of the item is visible
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
        await new Promise(resolve => setTimeout(resolve, 500)); // Short delay after becoming visible

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
    const landingImage = document.getElementById('landing-image');
    const mainContent = document.getElementById('main-content-wrapper');

    if (!overlay || !landingImage || !mainContent) {
        console.error("Landing sequence elements not found. Skipping sequence.");
        showMainContentAndInitPortfolio();
        return;
    }

    let photoNumbers = [];
    for (let i = 1; i <= TOTAL_AVAILABLE_PHOTOS; i++) {
        photoNumbers.push(i);
    }

    // Shuffle photoNumbers (Fisher-Yates)
    for (let i = photoNumbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [photoNumbers[i], photoNumbers[j]] = [photoNumbers[j], photoNumbers[i]];
    }

    const sequencePhotos = photoNumbers.slice(0, 10); // Changed from 20 to 10
    console.log("[Landing] Starting sequence with 10 random photos.");

    // Preload images for the sequence
    const preloadPromises = sequencePhotos.map(photoNum => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => {
                console.warn(`[Landing] Failed to preload image: images/photo-${photoNum}.jpg`);
                resolve(null); // Resolve with null on error to not break Promise.allSettled
            };
            img.src = `images/photo-${photoNum}.jpg`;
        });
    });

    console.log("[Landing] Preloading images...");
    await Promise.allSettled(preloadPromises);
    console.log("[Landing] Preloading finished.");

    for (let i = 0; i < sequencePhotos.length; i++) {
        const photoNum = sequencePhotos[i];
        // It's good practice to re-check if landingImage is still in DOM,
        // though in this flow it should be.
        if (!document.body.contains(landingImage)) {
            console.warn("[Landing] Landing image element removed prematurely. Stopping sequence.");
            break;
        }
        landingImage.src = `images/photo-${photoNum}.jpg`;
        landingImage.style.opacity = '1';
        // Wait 0.25s while image is visible (includes 0.05s fade-in)
        await new Promise(resolve => setTimeout(resolve, 250)); 
        landingImage.style.opacity = '0';
        // Wait 0.05s for fade-out to complete
        await new Promise(resolve => setTimeout(resolve, 50)); 
    }

    console.log("[Landing] Sequence finished.");
    overlay.style.display = 'none';
    showMainContentAndInitPortfolio();
}

function showMainContentAndInitPortfolio() {
    const mainContent = document.getElementById('main-content-wrapper');
    if (mainContent) {
        mainContent.style.display = 'block';
    }

    window.portfolio = new PhotographyPortfolio(); // Make instance globally accessible

    console.log(
`🖼️ LOCAL PHOTO MODE:
- Loading ${window.portfolio.totalPhotos} photos from the local 'images' folder.
- Attempting to extract EXIF data for each photo.
- Ensure 'images/photo_001.jpg' to 'images/photo_${window.portfolio.totalPhotos.toString().padStart(3, '0')}.jpg' exist.`
    );
}

document.addEventListener('DOMContentLoaded', () => {
    startLandingSequence(); // Start the landing sequence instead of direct init
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
